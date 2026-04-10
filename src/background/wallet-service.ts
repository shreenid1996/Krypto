/**
 * WalletService — manages vault lifecycle and in-memory session.
 *
 * All key material lives only in this module's in-memory session.
 * The popup never receives raw keys or mnemonics except via explicit
 * REVEAL_MNEMONIC / EXPORT_PRIVATE_KEY flows (after password re-auth).
 */

import { generateMnemonic, validateMnemonic } from '../lib/crypto/mnemonic';
import { encryptVault, decryptVault } from '../lib/crypto/vault';
import { saveVault, loadVault, hasVault } from '../lib/storage/idb';
import { KryptoError } from '../domain/errors';
import type { Chain, DerivedAccount, SessionState, VaultPayload } from '../domain/types';
import { getAdapter } from '../lib/chains/index';

// ─── In-memory session (cleared on lock / SW restart) ────────────────────────

let session: SessionState = {
  unlocked: false,
  mnemonic: null,
  accounts: [],
  activeAccountIds: {},
  lastActivityAt: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireUnlocked(): string {
  if (!session.unlocked || !session.mnemonic) {
    throw new KryptoError('VAULT_LOCKED', 'Wallet is locked. Please unlock to continue.');
  }
  return session.mnemonic;
}

async function persistVault(mnemonic: string, password: string): Promise<void> {
  const payload: VaultPayload = {
    mnemonic,
    accounts: session.accounts,
    activeAccountIds: session.activeAccountIds,
  };
  const encrypted = await encryptVault(payload, password);
  await saveVault(encrypted);
}

async function deriveInitialAccounts(mnemonic: string): Promise<DerivedAccount[]> {
  const chains: Chain[] = ['solana', 'ethereum', 'bitcoin'];
  const accounts: DerivedAccount[] = [];
  for (const chain of chains) {
    const adapter = getAdapter(chain);
    const account = await adapter.deriveAccount(mnemonic, 0);
    accounts.push(account);
  }
  return accounts;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a new wallet: generates mnemonic, derives first accounts for all
 * three chains, encrypts and persists the vault.
 */
export async function createWallet(
  password: string,
): Promise<{ mnemonic: string; accounts: DerivedAccount[] }> {
  const mnemonic = generateMnemonic();
  const accounts = await deriveInitialAccounts(mnemonic);

  // Set active account for each chain to the first derived account
  const activeAccountIds: Partial<Record<Chain, string>> = {};
  for (const account of accounts) {
    activeAccountIds[account.chain] = account.id;
  }

  session = {
    unlocked: true,
    mnemonic,
    accounts,
    activeAccountIds,
    lastActivityAt: Date.now(),
  };

  await persistVault(mnemonic, password);
  return { mnemonic, accounts };
}

/**
 * Imports an existing wallet from a BIP-39 mnemonic phrase.
 */
export async function importWallet(
  mnemonic: string,
  password: string,
): Promise<{ accounts: DerivedAccount[] }> {
  if (!validateMnemonic(mnemonic)) {
    throw new KryptoError('INVALID_MNEMONIC', 'Invalid BIP-39 mnemonic phrase.');
  }

  const accounts = await deriveInitialAccounts(mnemonic);
  const activeAccountIds: Partial<Record<Chain, string>> = {};
  for (const account of accounts) {
    activeAccountIds[account.chain] = account.id;
  }

  session = {
    unlocked: true,
    mnemonic,
    accounts,
    activeAccountIds,
    lastActivityAt: Date.now(),
  };

  await persistVault(mnemonic, password);
  return { accounts };
}

/**
 * Unlocks the wallet by decrypting the vault with the given password.
 * Throws INVALID_PASSWORD if the password is wrong.
 * Throws VAULT_LOCKED if no vault exists yet.
 */
export async function unlock(password: string): Promise<void> {
  const encrypted = await loadVault();
  if (!encrypted) {
    throw new KryptoError('VAULT_LOCKED', 'No wallet found. Please create or import a wallet.');
  }

  // decryptVault throws INVALID_PASSWORD on wrong password
  const payload = await decryptVault(encrypted, password);

  session = {
    unlocked: true,
    mnemonic: payload.mnemonic,
    accounts: payload.accounts,
    activeAccountIds: payload.activeAccountIds,
    lastActivityAt: Date.now(),
  };
}

/**
 * Locks the wallet by clearing all in-memory secrets.
 */
export function lock(): void {
  session = {
    unlocked: false,
    mnemonic: null,
    accounts: [],
    activeAccountIds: {},
    lastActivityAt: 0,
  };
}

export function isUnlocked(): boolean {
  return session.unlocked;
}

export function getSession(): Readonly<SessionState> {
  return session;
}

/**
 * Returns the mnemonic. Requires the wallet to be unlocked.
 * Used only after password re-authentication in the Security screen.
 */
export function getMnemonic(): string {
  return requireUnlocked();
}

/**
 * Returns true if a vault has been stored (wallet has been created/imported).
 */
export async function walletExists(): Promise<boolean> {
  return hasVault();
}

/**
 * Saves the current session state back to the encrypted vault.
 * Called after any mutation (add account, rename, hide, etc.).
 */
export async function saveSession(password: string): Promise<void> {
  const mnemonic = requireUnlocked();
  await persistVault(mnemonic, password);
}

/** Exposes session accounts for AccountService mutations */
export function getSessionAccounts(): DerivedAccount[] {
  return session.accounts;
}

export function setSessionAccounts(accounts: DerivedAccount[]): void {
  session = { ...session, accounts };
}

export function getSessionActiveIds(): Partial<Record<Chain, string>> {
  return session.activeAccountIds;
}

export function setSessionActiveIds(ids: Partial<Record<Chain, string>>): void {
  session = { ...session, activeAccountIds: ids };
}

export function touchSession(): void {
  session = { ...session, lastActivityAt: Date.now() };
}
