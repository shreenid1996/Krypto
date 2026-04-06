/**
 * Vault encryption / decryption using Web Crypto API.
 *
 * Key derivation : PBKDF2 — SHA-256, 210 000 iterations
 * Encryption     : AES-GCM — 256-bit key, 12-byte IV
 */

import type { EncryptedVault, VaultPayload } from '../../domain/types';
import { KryptoError } from '../../domain/errors';

// ─── Constants ────────────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 210_000;
/** Reduced iteration count used in tests to keep them fast */
export const PBKDF2_ITERATIONS_TEST = 1_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const VAULT_VERSION = 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypts a VaultPayload with the given password.
 * Returns an EncryptedVault safe to persist in IndexedDB.
 * @param iterations Override PBKDF2 iterations (use PBKDF2_ITERATIONS_TEST in tests)
 */
export async function encryptVault(
  payload: VaultPayload,
  password: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES)) as Uint8Array<ArrayBuffer>;
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES)) as Uint8Array<ArrayBuffer>;
  const key = await deriveKey(password, salt, iterations);

  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(payload));

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, plaintext);

  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    salt: toBase64(salt),
    version: VAULT_VERSION,
  };
}

/**
 * Decrypts an EncryptedVault with the given password.
 * Throws KryptoError(INVALID_PASSWORD) if decryption fails.
 * @param iterations Must match the value used during encryption
 */
export async function decryptVault(
  vault: EncryptedVault,
  password: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<VaultPayload> {
  const salt = fromBase64(vault.salt) as Uint8Array<ArrayBuffer>;
  const iv = fromBase64(vault.iv) as Uint8Array<ArrayBuffer>;
  const ciphertext = fromBase64(vault.ciphertext).buffer as ArrayBuffer;

  const key = await deriveKey(password, salt, iterations);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, ciphertext);
  } catch {
    throw new KryptoError('INVALID_PASSWORD', 'Incorrect password — vault decryption failed.');
  }

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(plaintext)) as VaultPayload;
}
