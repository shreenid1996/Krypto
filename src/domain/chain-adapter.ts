import type { Chain, DerivedAccount, FeeEstimate, UnsignedTx } from './types';

export interface ChainAdapter {
  readonly chain: Chain;

  /** Returns true if the address string is valid for this chain */
  validateAddress(address: string): boolean;

  /** Derives a DerivedAccount at the given HD index from the mnemonic */
  deriveAccount(mnemonic: string, index: number): Promise<DerivedAccount>;

  /** Returns the native balance in smallest unit (lamports / wei / satoshis) */
  getBalance(address: string, rpcUrl: string): Promise<bigint>;

  /** Estimates the network fee for a transfer */
  estimateFee(from: string, to: string, amount: bigint, rpcUrl: string): Promise<FeeEstimate>;

  /** Builds an unsigned transaction */
  buildTransaction(
    from: string,
    to: string,
    amount: bigint,
    fee: FeeEstimate,
    rpcUrl: string
  ): Promise<UnsignedTx>;

  /** Signs the transaction and returns a serialized signed tx (hex or base64) */
  signTransaction(tx: UnsignedTx, mnemonic: string, index: number): Promise<string>;

  /** Broadcasts the signed tx and returns the transaction hash */
  broadcastTransaction(signedTx: string, rpcUrl: string): Promise<string>;
}
