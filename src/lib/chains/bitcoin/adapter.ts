/**
 * Bitcoin ChainAdapter implementation (native SegWit P2WPKH).
 * Uses Blockstream API for UTXO fetching and broadcasting.
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import { ECPairFactory } from 'ecpair';
import * as bip39 from 'bip39';
import type { ChainAdapter } from '../../../domain/chain-adapter';
import type { DerivedAccount, FeeEstimate, UnsignedTx } from '../../../domain/types';
import { KryptoError } from '../../../domain/errors';
import { deriveBitcoinAccount } from './derive';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);
const BTC_NETWORK = bitcoin.networks.bitcoin;
const BTC_PATH_PREFIX = "m/84'/0'/0'/0";

// Native SegWit bc1q address pattern
const BTC_BECH32_RE = /^bc1q[ac-hj-np-z02-9]{6,87}$/;

interface Utxo {
  txid: string;
  vout: number;
  value: number; // satoshis
  status: { confirmed: boolean };
}

export class BitcoinAdapter implements ChainAdapter {
  readonly chain = 'bitcoin' as const;

  validateAddress(address: string): boolean {
    if (!BTC_BECH32_RE.test(address)) return false;
    try {
      bitcoin.address.toOutputScript(address, BTC_NETWORK);
      return true;
    } catch {
      return false;
    }
  }

  async deriveAccount(mnemonic: string, index: number): Promise<DerivedAccount> {
    return deriveBitcoinAccount(mnemonic, index);
  }

  async getBalance(address: string, rpcUrl: string): Promise<bigint> {
    try {
      const res = await fetch(`${rpcUrl}/address/${address}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        chain_stats: { funded_txo_sum: number; spent_txo_sum: number };
      };
      const balance = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
      return BigInt(balance);
    } catch (err) {
      throw new KryptoError('NETWORK_ERROR', `Failed to fetch BTC balance: ${String(err)}`, err);
    }
  }

  async estimateFee(
    _from: string,
    _to: string,
    _amount: bigint,
    rpcUrl: string,
  ): Promise<FeeEstimate> {
    try {
      // Fetch fee rate (sat/vbyte) for ~1 block confirmation
      const res = await fetch(`${rpcUrl}/fee-estimates`);
      const rates = await res.json() as Record<string, number>;
      const feeRateSatVbyte = Math.ceil(rates['1'] ?? rates['2'] ?? 10);

      // P2WPKH tx: ~141 vbytes (1 input, 2 outputs)
      const vbytes = 141;
      const fee = BigInt(feeRateSatVbyte * vbytes);
      const feeHuman = `${(Number(fee) / 1e8).toFixed(8)} BTC`;
      return { fee, feeHuman, ..._btcExtra({ feeRateSatVbyte }) } as FeeEstimate & BtcFeeExtra;
    } catch {
      const fee = 1410n; // 10 sat/vbyte fallback
      return { fee, feeHuman: '0.00001410 BTC', ..._btcExtra({ feeRateSatVbyte: 10 }) } as FeeEstimate & BtcFeeExtra;
    }
  }

  async buildTransaction(
    from: string,
    to: string,
    amount: bigint,
    fee: FeeEstimate,
    rpcUrl: string,
  ): Promise<UnsignedTx> {
    if (!this.validateAddress(to)) {
      throw new KryptoError('ADDRESS_INVALID', `Invalid Bitcoin recipient address: ${to}`);
    }

    try {
      // Fetch UTXOs
      const res = await fetch(`${rpcUrl}/address/${from}/utxo`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const utxos = await res.json() as Utxo[];

      // Select UTXOs (simple largest-first)
      const target = amount + fee.fee;
      let inputSum = 0n;
      const selected: Utxo[] = [];

      for (const utxo of utxos.sort((a, b) => b.value - a.value)) {
        selected.push(utxo);
        inputSum += BigInt(utxo.value);
        if (inputSum >= target) break;
      }

      if (inputSum < target) {
        throw new KryptoError('INSUFFICIENT_FUNDS', 'Insufficient BTC UTXOs to cover amount and fee.');
      }

      // Fetch raw txs for each input (needed for PSBT witness data)
      const psbt = new bitcoin.Psbt({ network: BTC_NETWORK });

      for (const utxo of selected) {
        const txRes = await fetch(`${rpcUrl}/tx/${utxo.txid}/hex`);
        const txHex = await txRes.text();
        const prevTx = bitcoin.Transaction.fromHex(txHex);
        const output = prevTx.outs[utxo.vout];

        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: output.script,
            value: utxo.value,
          },
        });
      }

      // Recipient output
      psbt.addOutput({
        address: to,
        value: Number(amount),
      });

      // Change output (if any)
      const change = inputSum - amount - fee.fee;
      if (change > 546n) {
        psbt.addOutput({ address: from, value: Number(change) });
      }

      return { chain: 'bitcoin', payload: psbt.toBase64() };
    } catch (err) {
      if (err instanceof KryptoError) throw err;
      throw new KryptoError('TX_BUILD_FAILED', `Failed to build BTC transaction: ${String(err)}`, err);
    }
  }

  async signTransaction(tx: UnsignedTx, mnemonic: string, index: number): Promise<string> {
    try {
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const root = bip32.fromSeed(seed, BTC_NETWORK);
      const path = `${BTC_PATH_PREFIX}/${index}`;
      const child = root.derivePath(path);

      if (!child.privateKey) {
        throw new Error('Failed to derive Bitcoin private key');
      }

      const keyPair = ECPair.fromPrivateKey(Buffer.from(child.privateKey), { network: BTC_NETWORK });
      const psbt = bitcoin.Psbt.fromBase64(tx.payload as string, { network: BTC_NETWORK });

      for (let i = 0; i < psbt.data.inputs.length; i++) {
        psbt.signInput(i, keyPair);
      }

      psbt.finalizeAllInputs();
      return psbt.extractTransaction().toHex();
    } catch (err) {
      if (err instanceof KryptoError) throw err;
      throw new KryptoError('TX_SIGN_FAILED', `Failed to sign BTC transaction: ${String(err)}`, err);
    }
  }

  async broadcastTransaction(signedTx: string, rpcUrl: string): Promise<string> {
    try {
      const res = await fetch(`${rpcUrl}/tx`, {
        method: 'POST',
        body: signedTx,
        headers: { 'Content-Type': 'text/plain' },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      return await res.text(); // txid
    } catch (err) {
      throw new KryptoError('TX_BROADCAST_FAILED', `Failed to broadcast BTC transaction: ${String(err)}`, err);
    }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface BtcFeeExtra {
  feeRateSatVbyte: number;
}

function _btcExtra(data: BtcFeeExtra): BtcFeeExtra {
  return data;
}

export const bitcoinAdapter = new BitcoinAdapter();
