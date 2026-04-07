/**
 * Solana ChainAdapter implementation.
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmRawTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { HDKey } from 'micro-ed25519-hdkey';
import * as bip39 from 'bip39';
import * as ed25519 from '@noble/ed25519';
import type { ChainAdapter } from '../../../domain/chain-adapter';
import type { DerivedAccount, FeeEstimate, UnsignedTx } from '../../../domain/types';
import { KryptoError } from '../../../domain/errors';
import { deriveSolanaAccount, solanaDerPath } from './derive';

// Solana base58 address: 32-44 chars, base58 alphabet
const SOL_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export class SolanaAdapter implements ChainAdapter {
  readonly chain = 'solana' as const;

  validateAddress(address: string): boolean {
    if (!SOL_ADDRESS_RE.test(address)) return false;
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  async deriveAccount(mnemonic: string, index: number): Promise<DerivedAccount> {
    return deriveSolanaAccount(mnemonic, index);
  }

  async getBalance(address: string, rpcUrl: string): Promise<bigint> {
    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const pubkey = new PublicKey(address);
      const lamports = await connection.getBalance(pubkey);
      return BigInt(lamports);
    } catch (err) {
      throw new KryptoError('NETWORK_ERROR', `Failed to fetch Solana balance: ${String(err)}`, err);
    }
  }

  async estimateFee(_from: string, _to: string, _amount: bigint, rpcUrl: string): Promise<FeeEstimate> {
    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      // Standard SOL transfer fee is 5000 lamports (one signature)
      const { feeCalculator } = await connection.getRecentBlockhash();
      const fee = BigInt(feeCalculator?.lamportsPerSignature ?? 5000);
      const feeHuman = `${(Number(fee) / LAMPORTS_PER_SOL).toFixed(9)} SOL`;
      return { fee, feeHuman };
    } catch {
      // Fallback to standard fee
      const fee = 5000n;
      return { fee, feeHuman: '0.000005000 SOL' };
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
      throw new KryptoError('ADDRESS_INVALID', `Invalid Solana recipient address: ${to}`);
    }

    const balance = await this.getBalance(from, rpcUrl);
    if (balance < amount + fee.fee) {
      throw new KryptoError('INSUFFICIENT_FUNDS', 'Insufficient SOL balance to cover amount and fee.');
    }

    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const { blockhash } = await connection.getLatestBlockhash();
      const fromPubkey = new PublicKey(from);
      const toPubkey = new PublicKey(to);

      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: fromPubkey,
      }).add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: amount,
        }),
      );

      return { chain: 'solana', payload: tx };
    } catch (err) {
      throw new KryptoError('TX_BUILD_FAILED', `Failed to build Solana transaction: ${String(err)}`, err);
    }
  }

  async signTransaction(tx: UnsignedTx, mnemonic: string, index: number): Promise<string> {
    try {
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const hdkey = HDKey.fromMasterSeed(seed);
      const child = hdkey.derive(solanaDerPath(index));

      if (!child.privateKey || !child.publicKey) {
        throw new Error('Failed to derive Solana keypair');
      }

      const transaction = tx.payload as Transaction;
      const message = transaction.serializeMessage();
      const signature = await ed25519.sign(message, child.privateKey);

      const pubkey = new PublicKey(child.publicKey);
      transaction.addSignature(pubkey, Buffer.from(signature));

      return transaction.serialize().toString('base64');
    } catch (err) {
      if (err instanceof KryptoError) throw err;
      throw new KryptoError('TX_SIGN_FAILED', `Failed to sign Solana transaction: ${String(err)}`, err);
    }
  }

  async broadcastTransaction(signedTx: string, rpcUrl: string): Promise<string> {
    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const rawTx = Buffer.from(signedTx, 'base64');
      const txHash = await sendAndConfirmRawTransaction(connection, rawTx, { commitment: 'confirmed' });
      return txHash;
    } catch (err) {
      throw new KryptoError('TX_BROADCAST_FAILED', `Failed to broadcast Solana transaction: ${String(err)}`, err);
    }
  }
}

export const solanaAdapter = new SolanaAdapter();
