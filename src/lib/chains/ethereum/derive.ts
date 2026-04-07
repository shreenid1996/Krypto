/**
 * Ethereum HD account derivation.
 * Path: m/44'/60'/0'/0/{index}
 */

import { HDNodeWallet, Mnemonic } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import type { DerivedAccount } from '../../../domain/types';

const ETH_PATH_PREFIX = "m/44'/60'/0'/0";

/**
 * Derives an Ethereum account at the given index from a BIP-39 mnemonic.
 */
export async function deriveEthereumAccount(
  mnemonic: string,
  index: number,
): Promise<DerivedAccount> {
  const path = `${ETH_PATH_PREFIX}/${index}`;
  const mnemonicObj = Mnemonic.fromPhrase(mnemonic);
  const wallet = HDNodeWallet.fromMnemonic(mnemonicObj, path);

  return {
    id: uuidv4(),
    chain: 'ethereum',
    index,
    address: wallet.address,
    name: `Ethereum ${index + 1}`,
    hidden: false,
  };
}

/**
 * Derives the raw private key (hex) for an Ethereum account at the given index.
 * Used only for the export-private-key flow after password re-auth.
 */
export function deriveEthereumPrivateKey(mnemonic: string, index: number): string {
  const path = `${ETH_PATH_PREFIX}/${index}`;
  const mnemonicObj = Mnemonic.fromPhrase(mnemonic);
  const wallet = HDNodeWallet.fromMnemonic(mnemonicObj, path);
  return wallet.privateKey; // 0x-prefixed hex
}
