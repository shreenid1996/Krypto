/**
 * Zustand store — UI state for the popup.
 * Holds session state, active chain, accounts, and current screen.
 */

import { create } from 'zustand';
import type { Chain, DerivedAccount } from '../domain/types';

// ─── Screen names ─────────────────────────────────────────────────────────────

export type Screen =
  | 'loading'
  | 'welcome'
  | 'create-wallet'
  | 'verify-phrase'
  | 'import-wallet'
  | 'unlock'
  | 'dashboard'
  | 'send'
  | 'receive'
  | 'manage-accounts'
  | 'settings'
  | 'security';

// ─── Store shape ──────────────────────────────────────────────────────────────

export interface KryptoStore {
  // Navigation
  screen: Screen;
  setScreen: (screen: Screen) => void;

  // Session
  unlocked: boolean;
  hasWallet: boolean;
  accounts: DerivedAccount[];
  activeAccountIds: Partial<Record<Chain, string>>;
  activeChain: Chain;

  // Setters
  setSession: (state: {
    unlocked: boolean;
    hasWallet: boolean;
    accounts: DerivedAccount[];
    activeAccountIds: Partial<Record<Chain, string>>;
    activeChain: Chain;
  }) => void;
  setActiveChain: (chain: Chain) => void;
  setAccounts: (accounts: DerivedAccount[]) => void;
  setActiveAccountIds: (ids: Partial<Record<Chain, string>>) => void;

  // Transient UI state
  pendingMnemonic: string | null;
  setPendingMnemonic: (mnemonic: string | null) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<KryptoStore>((set) => ({
  screen: 'loading',
  setScreen: (screen) => set({ screen }),

  unlocked: false,
  hasWallet: false,
  accounts: [],
  activeAccountIds: {},
  activeChain: 'solana',

  setSession: ({ unlocked, hasWallet, accounts, activeAccountIds, activeChain }) =>
    set({ unlocked, hasWallet, accounts, activeAccountIds, activeChain }),

  setActiveChain: (activeChain) => set({ activeChain }),
  setAccounts: (accounts) => set({ accounts }),
  setActiveAccountIds: (activeAccountIds) => set({ activeAccountIds }),

  pendingMnemonic: null,
  setPendingMnemonic: (pendingMnemonic) => set({ pendingMnemonic }),
}));
