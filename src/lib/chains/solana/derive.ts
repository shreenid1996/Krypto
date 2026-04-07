/**
 * Solana HD account derivation.
 * Path: m/44'/501'/{index}'/0'
 */

import { HDKey } from 'micro-ed25519-hdkey';
import { PublicKey } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { v4 as uuidv4 } from 'uuid';
import type { DerivedAccount } from '../../../domain/types';

/**
 * Returns the BIP-44 derivation path for Solana at the given index.
 */
export function solanaDerPath(index: number): string {
  return `m/44'/501'/${index}'/0'`;
}

/**
 * Derives a Solana account at the given index from a BIP-39 mnemonic.
 */
export async function deriveSolanaAccount(
  mnemonic: string,
  index: number,
): Promise<DerivedAccount> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const path = solanaDerPath(index);
  const hdkey = HDKey.fromMasterSeed(seed);
  const child = hdkey.derive(path);

  if (!child.publicKey) {
    throw new Error('Failed to derive Solana public key');
  }

  const publicKey = new PublicKey(child.publicKey);

  return {
    id: uuidv4(),
    chain: 'solana',
    index,
    address: publicKey.toBase58(),
    name: `Solana ${index + 1}`,
    hidden: false,
  };
}

/**
 * Derives the raw private key (32-byte secret scalar) for a Solana account.
 * Used only for the export-private-key flow after password re-auth.
 */
export async function deriveSolanaPrivateKey(
  mnemonic: string,
  index: number,
): Promise<Uint8Array> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const path = solanaDerPath(index);
  const hdkey = HDKey.fromMasterSeed(seed);
  const child = hdkey.derive(path);

  if (!child.privateKey) {
    throw new Error('Failed to derive Solana private key');
  }

  return child.privateKey;
}
