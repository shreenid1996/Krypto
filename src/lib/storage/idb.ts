/**
 * IndexedDB wrapper for the encrypted vault.
 * Uses the `idb` library for a promise-based API.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { EncryptedVault } from '../../domain/types';

const DB_NAME = 'krypto-db';
const DB_VERSION = 1;
const VAULT_STORE = 'vault';
const VAULT_KEY = 'encrypted-vault';

type KryptoDB = {
  [VAULT_STORE]: {
    key: string;
    value: EncryptedVault;
  };
};

let _db: IDBPDatabase<KryptoDB> | null = null;

async function getDB(): Promise<IDBPDatabase<KryptoDB>> {
  if (_db) return _db;
  _db = await openDB<KryptoDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        db.createObjectStore(VAULT_STORE);
      }
    },
  });
  return _db;
}

/** Persists the encrypted vault to IndexedDB. */
export async function saveVault(vault: EncryptedVault): Promise<void> {
  const db = await getDB();
  await db.put(VAULT_STORE, vault, VAULT_KEY);
}

/** Reads the encrypted vault from IndexedDB. Returns null if none exists. */
export async function loadVault(): Promise<EncryptedVault | null> {
  const db = await getDB();
  return (await db.get(VAULT_STORE, VAULT_KEY)) ?? null;
}

/** Returns true if a vault has been stored. */
export async function hasVault(): Promise<boolean> {
  const vault = await loadVault();
  return vault !== null;
}

/** Deletes the vault (used for wallet reset). */
export async function deleteVault(): Promise<void> {
  const db = await getDB();
  await db.delete(VAULT_STORE, VAULT_KEY);
}
