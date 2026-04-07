/**
 * Ethereum ChainAdapter implementation (EIP-1559).
 */

import {
  JsonRpcProvider,
  Wallet,
  isAddress,
  formatEther,
  Mnemonic,
  HDNodeWallet,
} from 'ethers';
import type { ChainAdapter } from '../../../domain/chain-adapter';
import type { DerivedAccount, FeeEstimate, UnsignedTx } from '../../../domain/types';
import { KryptoError } from '../../../domain/errors';
import { deriveEthereumAccount } from './derive';

const ETH_PATH_PREFIX = "m/44'/60'/0'/0";

export class EthereumAdapter implements ChainAdapter {
  readonly chain = 'ethereum' as const;

  validateAddress(address: string): boolean {
    return isAddress(address);
  }

  async deriveAccount(mnemonic: string, index: number): Promise<DerivedAccount> {
    return deriveEthereumAccount(mnemonic, index);
  }

  async getBalance(address: string, rpcUrl: string): Promise<bigint> {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const balance = await provider.getBalance(address);
      return balance;
    } catch (err) {
      throw new KryptoError('NETWORK_ERROR', `Failed to fetch ETH balance: ${String(err)}`, err);
    }
  }

  async estimateFee(from: string, to: string, amount: bigint, rpcUrl: string): Promise<FeeEstimate> {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const feeData = await provider.getFeeData();

      const maxFeePerGas = feeData.maxFeePerGas ?? 20_000_000_000n; // 20 gwei fallback
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 1_000_000_000n; // 1 gwei fallback

      // Estimate gas for a standard ETH transfer (21000 gas)
      const gasLimit = await provider.estimateGas({
        from,
        to,
        value: amount,
      }).catch(() => 21000n);

      const fee = gasLimit * maxFeePerGas;
      const feeHuman = `${formatEther(fee)} ETH`;

      return {
        fee,
        feeHuman,
        // Store extra data needed for buildTransaction
        ..._extra({ maxFeePerGas, maxPriorityFeePerGas, gasLimit }),
      } as FeeEstimate & EthFeeExtra;
    } catch (err) {
      throw new KryptoError('NETWORK_ERROR', `Failed to estimate ETH fee: ${String(err)}`, err);
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
      throw new KryptoError('ADDRESS_INVALID', `Invalid Ethereum recipient address: ${to}`);
    }

    const balance = await this.getBalance(from, rpcUrl);
    if (balance < amount + fee.fee) {
      throw new KryptoError('INSUFFICIENT_FUNDS', 'Insufficient ETH balance to cover amount and fee.');
    }

    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const nonce = await provider.getTransactionCount(from, 'pending');
      const network = await provider.getNetwork();
      const extra = fee as FeeEstimate & EthFeeExtra;

      const txData = {
        type: 2, // EIP-1559
        chainId: network.chainId,
        nonce,
        to,
        value: amount,
        gasLimit: extra.gasLimit ?? 21000n,
        maxFeePerGas: extra.maxFeePerGas ?? 20_000_000_000n,
        maxPriorityFeePerGas: extra.maxPriorityFeePerGas ?? 1_000_000_000n,
      };

      return { chain: 'ethereum', payload: txData };
    } catch (err) {
      throw new KryptoError('TX_BUILD_FAILED', `Failed to build ETH transaction: ${String(err)}`, err);
    }
  }

  async signTransaction(tx: UnsignedTx, mnemonic: string, index: number): Promise<string> {
    try {
      const path = `${ETH_PATH_PREFIX}/${index}`;
      const mnemonicObj = Mnemonic.fromPhrase(mnemonic);
      const hdWallet = HDNodeWallet.fromMnemonic(mnemonicObj, path);
      const wallet = new Wallet(hdWallet.privateKey);

      const txData = tx.payload as Parameters<Wallet['signTransaction']>[0];
      const signed = await wallet.signTransaction(txData);
      return signed;
    } catch (err) {
      if (err instanceof KryptoError) throw err;
      throw new KryptoError('TX_SIGN_FAILED', `Failed to sign ETH transaction: ${String(err)}`, err);
    }
  }

  async broadcastTransaction(signedTx: string, rpcUrl: string): Promise<string> {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const response = await provider.broadcastTransaction(signedTx);
      return response.hash;
    } catch (err) {
      throw new KryptoError('TX_BROADCAST_FAILED', `Failed to broadcast ETH transaction: ${String(err)}`, err);
    }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface EthFeeExtra {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  gasLimit: bigint;
}

function _extra(data: EthFeeExtra): EthFeeExtra {
  return data;
}

export const ethereumAdapter = new EthereumAdapter();
