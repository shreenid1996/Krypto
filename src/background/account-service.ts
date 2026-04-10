/**
 * AccountService — manages derived accounts within the unlocked session.
 *
 * All mutations update the in-memory session via wallet-service helpers
 * and re-encrypt the vault to persist changes.
 */

import { KryptoError } from '../domain/errors';
import type { Chain, DerivedAccount } from '../domain/types';
import { getAdapter } from '../lib/chains/index';
import {
  getMnemonic,
  getSessionAccounts,
  setSessionAccounts,
  getSessionActiveIds,
  setSessionActiveIds,
} from './wallet-service';
import { deriveEthereumPrivateKey } from '../lib/chains/ethereum/derive';
import { deriveSolanaPrivateKey } from '../lib/chains/solana/derive';
import { deriveBitcoinPrivateKey } from '../lib/chains/bitcoin/derive';
import { loadVault } from '../lib/storage/idb';
import { decryptVault } from '../lib/crypto/vault';
import { saveVault } from '../lib/storage/idb';
import { encryptVault } from '../lib/crypto/vault';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Persists the current account list to the encrypted vault.
 * Called by the message router after any account mutation.
 */
export async function persistAccountsWithPassword(password: string): Promise<void> {
  const mnemonic = getMnemonic();
  const accounts = getSessionAccounts();
  const activeAccountIds = getSessionActiveIds();
  const encrypted = await encryptVault({ mnemonic, accounts, activeAccountIds }, password);
  await saveVault(encrypted);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns all non-hidden accounts. Pass includeHidden=true to get all. */
export function getAccounts(includeHidden = false): DerivedAccount[] {
  const accounts = getSessionAccounts();
  return includeHidden ? accounts : accounts.filter((a) => !a.hidden);
}

/**
 * Derives the next account for the given chain and adds it to the session.
 * Returns the new account (caller must persist via persistAccountsWithPassword).
 */
export async function deriveAccount(chain: Chain): Promise<DerivedAccount> {
  const mnemonic = getMnemonic();
  const accounts = getSessionAccounts();

  // Find the next index for this chain
  const chainAccounts = accounts.filter((a) => a.chain === chain);
  const nextIndex = chainAccounts.length > 0
    ? Math.max(...chainAccounts.map((a) => a.index)) + 1
    : 0;

  const adapter = getAdapter(chain);
  const newAccount = await adapter.deriveAccount(mnemonic, nextIndex);

  setSessionAccounts([...accounts, newAccount]);
  return newAccount;
}

/** Renames an account by id. Returns updated account. */
export function renameAccount(id: string, name: string): DerivedAccount {
  const accounts = getSessionAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) {
    throw new KryptoError('VAULT_LOCKED', `Account ${id} not found.`);
  }
  const updated = { ...accounts[idx], name };
  const newAccounts = [...accounts];
  newAccounts[idx] = updated;
  setSessionAccounts(newAccounts);
  return updated;
}

/** Sets the hidden flag on an account. */
export function hideAccount(id: string, hidden: boolean): DerivedAccount {
  const accounts = getSessionAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) {
    throw new KryptoError('VAULT_LOCKED', `Account ${id} not found.`);
  }
  const updated = { ...accounts[idx], hidden };
  const newAccounts = [...accounts];
  newAccounts[idx] = updated;
  setSessionAccounts(newAccounts);
  return updated;
}

/** Sets the active account for a chain. */
export function setActiveAccount(chain: Chain, id: string): void {
  const accounts = getSessionAccounts();
  const exists = accounts.some((a) => a.id === id && a.chain === chain);
  if (!exists) {
    throw new KryptoError('VAULT_LOCKED', `Account ${id} not found for chain ${chain}.`);
  }
  const ids = { ...getSessionActiveIds(), [chain]: id };
  setSessionActiveIds(ids);
}

/** Returns the active account for a chain, or undefined. */
export function getActiveAccount(chain: Chain): DerivedAccount | undefined {
  const activeId = getSessionActiveIds()[chain];
  if (!activeId) return undefined;
  return getSessionAccounts().find((a) => a.id === activeId && a.chain === chain);
}

/**
 * Exports the private key for an account after password re-authentication.
 * Returns the private key as a hex string (ETH), base58 WIF (BTC), or hex (SOL).
 */
export async function exportPrivateKey(id: string, password: string): Promise<string> {
  // Re-authenticate: decrypt vault with provided password
  const encrypted = await loadVault();
  if (!encrypted) {
    throw new KryptoError('VAULT_LOCKED', 'No vault found.');
  }
  // This will throw INVALID_PASSWORD if wrong
  const payload = await decryptVault(encrypted, password);

  const account = payload.accounts.find((a) => a.id === id);
  if (!account) {
    throw new KryptoError('VAULT_LOCKED', `Account ${id} not found in vault.`);
  }

  const { mnemonic } = payload;

  switch (account.chain) {
    case 'ethereum':
      return deriveEthereumPrivateKey(mnemonic, account.index);
    case 'solana': {
      const key = await deriveSolanaPrivateKey(mnemonic, account.index);
      return Buffer.from(key).toString('hex');
    }
    case 'bitcoin':
      return deriveBitcoinPrivateKey(mnemonic, account.index);
  }
}
