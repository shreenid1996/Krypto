export type ErrorCode =
  | 'INVALID_MNEMONIC'
  | 'INVALID_PASSWORD'
  | 'VAULT_LOCKED'
  | 'ADDRESS_INVALID'
  | 'INSUFFICIENT_FUNDS'
  | 'TX_BUILD_FAILED'
  | 'TX_SIGN_FAILED'
  | 'TX_BROADCAST_FAILED'
  | 'NETWORK_ERROR';

export class KryptoError extends Error {
  public readonly code: ErrorCode;
  public readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'KryptoError';
    this.code = code;
    this.cause = cause;
  }
}

/** Human-readable messages shown in the popup UI */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_MNEMONIC: 'Invalid recovery phrase. Please check each word and try again.',
  INVALID_PASSWORD: 'Incorrect password. Please try again.',
  VAULT_LOCKED: 'Wallet is locked. Please unlock to continue.',
  ADDRESS_INVALID: 'Invalid recipient address for this network.',
  INSUFFICIENT_FUNDS: 'Insufficient balance to cover amount and network fee.',
  TX_BUILD_FAILED: 'Failed to build transaction. Please try again.',
  TX_SIGN_FAILED: 'Failed to sign transaction.',
  TX_BROADCAST_FAILED: 'Transaction failed to broadcast. Please try again.',
  NETWORK_ERROR: 'Network request failed. Check your connection and try again.',
};

/** Serialize a KryptoError for cross-context message passing */
export function serializeError(err: KryptoError): { code: ErrorCode; message: string } {
  return { code: err.code, message: err.message };
}

/** Reconstruct a KryptoError from a serialized form */
export function deserializeError(raw: { code: ErrorCode; message: string }): KryptoError {
  return new KryptoError(raw.code, raw.message);
}
