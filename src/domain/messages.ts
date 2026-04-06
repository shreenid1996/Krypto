import type { Chain, DerivedAccount, FeeEstimate, UserSettings } from './types';
import type { ErrorCode } from './errors';

// ─── Requests (popup → background) ───────────────────────────────────────────

export type BackgroundRequest =
  | { type: 'CREATE_WALLET'; password: string }
  | { type: 'IMPORT_WALLET'; mnemonic: string; password: string }
  | { type: 'UNLOCK'; password: string }
  | { type: 'LOCK' }
  | { type: 'GET_SESSION_STATE' }
  | { type: 'GET_ACCOUNTS' }
  | { type: 'DERIVE_ACCOUNT'; chain: Chain }
  | { type: 'RENAME_ACCOUNT'; id: string; name: string }
  | { type: 'HIDE_ACCOUNT'; id: string; hidden: boolean }
  | { type: 'SET_ACTIVE_ACCOUNT'; chain: Chain; id: string }
  | { type: 'GET_BALANCE'; chain: Chain; address: string }
  | { type: 'ESTIMATE_FEE'; chain: Chain; from: string; to: string; amount: string }
  | { type: 'SIGN_AND_SEND'; chain: Chain; to: string; amount: string }
  | { type: 'EXPORT_PRIVATE_KEY'; id: string; password: string }
  | { type: 'REVEAL_MNEMONIC'; password: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<UserSettings> };

// ─── Responses (background → popup) ──────────────────────────────────────────

export type BackgroundResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };

// ─── Typed response data shapes ───────────────────────────────────────────────

export interface CreateWalletResult {
  mnemonic: string;
  accounts: DerivedAccount[];
}

export interface ImportWalletResult {
  accounts: DerivedAccount[];
}

export interface SessionStateResult {
  unlocked: boolean;
  accounts: DerivedAccount[];
  activeAccountIds: Partial<Record<Chain, string>>;
  activeChain: Chain;
}

export interface BalanceResult {
  balance: string; // bigint serialized as string
  balanceHuman: string;
}

export interface FeeEstimateResult {
  estimate: { fee: string; feeHuman: string }; // bigint as string
}

export interface SendResult {
  txHash: string;
}
