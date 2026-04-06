// ─── Chain ────────────────────────────────────────────────────────────────────

export type Chain = 'solana' | 'ethereum' | 'bitcoin';

// ─── Account ──────────────────────────────────────────────────────────────────

export interface DerivedAccount {
  /** Stable UUID for this account record */
  id: string;
  chain: Chain;
  /** BIP-44/84 derivation index */
  index: number;
  /** On-chain address string */
  address: string;
  /** User-visible display name, e.g. "Solana 1" */
  name: string;
  /** Hidden accounts are excluded from the default list */
  hidden: boolean;
}

// ─── Vault ────────────────────────────────────────────────────────────────────

/** Persisted in IndexedDB — all fields are base64-encoded */
export interface EncryptedVault {
  /** AES-GCM ciphertext (base64) */
  ciphertext: string;
  /** 12-byte IV (base64) */
  iv: string;
  /** 16-byte PBKDF2 salt (base64) */
  salt: string;
  /** Schema version for future migrations */
  version: number;
}

/** In-memory only — never persisted in plaintext */
export interface VaultPayload {
  mnemonic: string;
  accounts: DerivedAccount[];
  /** One active account id per chain */
  activeAccountIds: Partial<Record<Chain, string>>;
}

// ─── Session ──────────────────────────────────────────────────────────────────

/** Lives only in the service worker's in-memory state */
export interface SessionState {
  unlocked: boolean;
  mnemonic: string | null;
  accounts: DerivedAccount[];
  activeAccountIds: Partial<Record<Chain, string>>;
  /** Unix ms — used to enforce auto-lock */
  lastActivityAt: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/** Stored in chrome.storage.local — non-sensitive only */
export interface UserSettings {
  /** 0 = never */
  autoLockMinutes: number;
  rpcEndpoints: Record<Chain, string>;
  activeChain: Chain;
}

export const DEFAULT_SETTINGS: UserSettings = {
  autoLockMinutes: 5,
  rpcEndpoints: {
    solana: 'https://api.mainnet-beta.solana.com',
    ethereum: 'https://eth.llamarpc.com',
    bitcoin: 'https://blockstream.info/api',
  },
  activeChain: 'solana',
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface FeeEstimate {
  /** In smallest unit: lamports / wei / satoshis */
  fee: bigint;
  /** Human-readable, e.g. "0.000005 SOL" */
  feeHuman: string;
}

export interface UnsignedTx {
  chain: Chain;
  /** Chain-specific transaction object (opaque to the domain layer) */
  payload: unknown;
}
