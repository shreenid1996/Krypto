/**
 * Bitcoin native SegWit (P2WPKH) HD account derivation.
 * Path: m/84'/0'/0'/0/{index}
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import * as bip39 from 'bip39';
import { v4 as uuidv4 } from 'uuid';
import type { DerivedAccount } from '../../../domain/types';

// Initialize BIP32 with the secp256k1 implementation
const bip32 = BIP32Factory(ecc);

const BTC_NETWORK = bitcoin.networks.bitcoin;
const BTC_PATH_PREFIX = "m/84'/0'/0'/0";

/**
 * Derives a Bitcoin native SegWit (bc1...) account at the given index.
 */
export async function deriveBitcoinAccount(
  mnemonic: string,
  index: number,
): Promise<DerivedAccount> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const root = bip32.fromSeed(seed, BTC_NETWORK);
  const path = `${BTC_PATH_PREFIX}/${index}`;
  const child = root.derivePath(path);

  if (!child.publicKey) {
    throw new Error('Failed to derive Bitcoin public key');
  }

  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network: BTC_NETWORK,
  });

  if (!address) {
    throw new Error('Failed to generate Bitcoin address');
  }

  return {
    id: uuidv4(),
    chain: 'bitcoin',
    index,
    address,
    name: `Bitcoin ${index + 1}`,
    hidden: false,
  };
}

/**
 * Derives the raw WIF-encoded private key for a Bitcoin account.
 * Used only for the export-private-key flow after password re-auth.
 */
export async function deriveBitcoinPrivateKey(
  mnemonic: string,
  index: number,
): Promise<string> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const root = bip32.fromSeed(seed, BTC_NETWORK);
  const path = `${BTC_PATH_PREFIX}/${index}`;
  const child = root.derivePath(path);

  if (!child.privateKey) {
    throw new Error('Failed to derive Bitcoin private key');
  }

  return child.toWIF();
}
