/**
 * BIP-39 mnemonic generation and validation.
 */

import * as bip39 from 'bip39';
import { KryptoError } from '../../domain/errors';

/**
 * Generates a cryptographically random 12-word BIP-39 mnemonic.
 * Uses 128 bits of entropy → 12 words.
 */
export function generateMnemonic(): string {
  return bip39.generateMnemonic(128);
}

/**
 * Returns true if the mnemonic is a valid BIP-39 phrase.
 * Checks word count, wordlist membership, and checksum.
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Converts a mnemonic to a BIP-39 seed buffer.
 * Throws INVALID_MNEMONIC if the phrase is invalid.
 */
export async function mnemonicToSeed(mnemonic: string): Promise<Buffer> {
  if (!validateMnemonic(mnemonic)) {
    throw new KryptoError('INVALID_MNEMONIC', 'Invalid BIP-39 mnemonic phrase.');
  }
  return bip39.mnemonicToSeed(mnemonic);
}
