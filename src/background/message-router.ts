/**
 * Message router — dispatches typed BackgroundRequest messages from the popup
 * to the appropriate service and returns a BackgroundResponse.
 *
 * All operations that mutate vault state require the caller to supply the
 * session password. For account mutations (rename, hide, derive) the router
 * re-uses the last-known password stored in the session context below.
 */

import type { BackgroundRequest, BackgroundResponse } from '../domain/messages';
import { serializeError, KryptoError } from '../domain/errors';
import {
  createWallet,
  importWallet,
  unlock,
  lock,
  isUnlocked,
  getSession,
  getMnemonic,
  walletExists,
  touchSession,
} from './wallet-service';
import {
  getAccounts,
  deriveAccount,
  renameAccount,
  hideAccount,
  setActiveAccount,
  exportPrivateKey,
  persistAccountsWithPassword,
} from './account-service';
import { getSettings, updateSettings } from './settings-service';
import { getAdapter } from '../lib/chains/index';
import { decryptVault } from '../lib/crypto/vault';
import { loadVault } from '../lib/storage/idb';
import type { Chain } from '../domain/types';

// ─── Session password cache ───────────────────────────────────────────────────
// We cache the password in memory while unlocked so account mutations can
// re-encrypt the vault without asking the user again.
// This is cleared on lock() / SW restart.

let _cachedPassword: string | null = null;

export function clearCachedPassword(): void {
  _cachedPassword = null;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function handleMessage(
  request: BackgroundRequest,
): Promise<BackgroundResponse> {
  try {
    touchSession();
    const result = await dispatch(request);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof KryptoError) {
      return { success: false, error: serializeError(err) };
    }
    // Unexpected error — wrap it
    const wrapped = new KryptoError('NETWORK_ERROR', String(err));
    return { success: false, error: serializeError(wrapped) };
  }
}

async function dispatch(req: BackgroundRequest): Promise<unknown> {
  switch (req.type) {
    // ── Wallet lifecycle ──────────────────────────────────────────────────────

    case 'CREATE_WALLET': {
      _cachedPassword = req.password;
      const result = await createWallet(req.password);
      return result;
    }

    case 'IMPORT_WALLET': {
      _cachedPassword = req.password;
      const result = await importWallet(req.mnemonic, req.password);
      return result;
    }

    case 'UNLOCK': {
      await unlock(req.password);
      _cachedPassword = req.password;
      const session = getSession();
      const settings = await getSettings();
      return {
        unlocked: true,
        accounts: session.accounts,
        activeAccountIds: session.activeAccountIds,
        activeChain: settings.activeChain,
      };
    }

    case 'LOCK': {
      lock();
      clearCachedPassword();
      return { unlocked: false };
    }

    case 'GET_SESSION_STATE': {
      const session = getSession();
      const settings = await getSettings();
      const exists = await walletExists();
      return {
        unlocked: session.unlocked,
        hasWallet: exists,
        accounts: session.accounts,
        activeAccountIds: session.activeAccountIds,
        activeChain: settings.activeChain,
      };
    }

    // ── Accounts ──────────────────────────────────────────────────────────────

    case 'GET_ACCOUNTS': {
      requireUnlocked();
      return { accounts: getAccounts() };
    }

    case 'DERIVE_ACCOUNT': {
      requireUnlocked();
      const newAccount = await deriveAccount(req.chain);
      await persistWithCachedPassword();
      return { account: newAccount };
    }

    case 'RENAME_ACCOUNT': {
      requireUnlocked();
      const updated = renameAccount(req.id, req.name);
      await persistWithCachedPassword();
      return { account: updated };
    }

    case 'HIDE_ACCOUNT': {
      requireUnlocked();
      const updated = hideAccount(req.id, req.hidden);
      await persistWithCachedPassword();
      return { account: updated };
    }

    case 'SET_ACTIVE_ACCOUNT': {
      requireUnlocked();
      setActiveAccount(req.chain, req.id);
      await persistWithCachedPassword();
      return { ok: true };
    }

    // ── Chain operations ──────────────────────────────────────────────────────

    case 'GET_BALANCE': {
      requireUnlocked();
      const settings = await getSettings();
      const rpcUrl = settings.rpcEndpoints[req.chain];
      const adapter = getAdapter(req.chain);
      const balance = await adapter.getBalance(req.address, rpcUrl);
      const balanceHuman = formatBalance(balance, req.chain);
      return { balance: balance.toString(), balanceHuman };
    }

    case 'ESTIMATE_FEE': {
      requireUnlocked();
      const settings = await getSettings();
      const rpcUrl = settings.rpcEndpoints[req.chain];
      const adapter = getAdapter(req.chain);
      const estimate = await adapter.estimateFee(
        req.from,
        req.to,
        BigInt(req.amount),
        rpcUrl,
      );
      return { estimate: { fee: estimate.fee.toString(), feeHuman: estimate.feeHuman } };
    }

    case 'SIGN_AND_SEND': {
      requireUnlocked();
      const mnemonic = getMnemonic();
      const settings = await getSettings();
      const rpcUrl = settings.rpcEndpoints[req.chain];
      const adapter = getAdapter(req.chain);
      const session = getSession();

      // Find the active account for this chain
      const activeId = session.activeAccountIds[req.chain];
      const account = session.accounts.find((a) => a.id === activeId && a.chain === req.chain);
      if (!account) {
        throw new KryptoError('VAULT_LOCKED', `No active account for chain ${req.chain}.`);
      }

      const amount = BigInt(req.amount);
      const fee = await adapter.estimateFee(account.address, req.to, amount, rpcUrl);
      const unsignedTx = await adapter.buildTransaction(account.address, req.to, amount, fee, rpcUrl);
      const signedTx = await adapter.signTransaction(unsignedTx, mnemonic, account.index);
      const txHash = await adapter.broadcastTransaction(signedTx, rpcUrl);
      return { txHash };
    }

    // ── Security ──────────────────────────────────────────────────────────────

    case 'EXPORT_PRIVATE_KEY': {
      const privateKey = await exportPrivateKey(req.id, req.password);
      return { privateKey };
    }

    case 'REVEAL_MNEMONIC': {
      // Re-authenticate before revealing
      const encrypted = await loadVault();
      if (!encrypted) throw new KryptoError('VAULT_LOCKED', 'No vault found.');
      const payload = await decryptVault(encrypted, req.password);
      return { mnemonic: payload.mnemonic };
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    case 'GET_SETTINGS': {
      return getSettings();
    }

    case 'UPDATE_SETTINGS': {
      const updated = await updateSettings(req.patch);
      return updated;
    }

    default: {
      const _exhaustive: never = req;
      throw new KryptoError('NETWORK_ERROR', `Unknown message type: ${(_exhaustive as BackgroundRequest).type}`);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireUnlocked(): void {
  if (!isUnlocked()) {
    throw new KryptoError('VAULT_LOCKED', 'Wallet is locked. Please unlock to continue.');
  }
}

async function persistWithCachedPassword(): Promise<void> {
  if (!_cachedPassword) {
    throw new KryptoError('VAULT_LOCKED', 'Session password not available. Please re-unlock.');
  }
  await persistAccountsWithPassword(_cachedPassword);
}

function formatBalance(balance: bigint, chain: Chain): string {
  switch (chain) {
    case 'solana':
      return `${(Number(balance) / 1e9).toFixed(9)} SOL`;
    case 'ethereum':
      return `${(Number(balance) / 1e18).toFixed(18)} ETH`;
    case 'bitcoin':
      return `${(Number(balance) / 1e8).toFixed(8)} BTC`;
  }
}
