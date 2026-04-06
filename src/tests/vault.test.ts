/**
 * Vault encryption tests
 *
 * Property 1: Vault encryption round trip
 *   **Feature: krypto-wallet, Property 1: Vault encryption round trip**
 *   Validates: Requirements 2.1, 13.2
 *
 * Property 2: Wrong password yields INVALID_PASSWORD
 *   **Feature: krypto-wallet, Property 2: Wrong password yields INVALID_PASSWORD**
 *   Validates: Requirements 2.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { encryptVault, decryptVault, PBKDF2_ITERATIONS_TEST } from '../lib/crypto/vault';
import { KryptoError } from '../domain/errors';
import type { VaultPayload } from '../domain/types';

// ─── Sample BIP-39 words (subset for test generators) ────────────────────────
const SAMPLE_WORDS = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent',
  'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident',
  'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire',
  'across', 'act', 'action', 'actor', 'actress', 'actual',
] as const;

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** A non-empty printable ASCII string (avoids control chars that confuse JSON) */
const printableString = fc.string({ minLength: 1, maxLength: 64 }).filter(
  (s) => s.trim().length > 0,
);

/** A minimal but structurally valid VaultPayload */
const vaultPayloadArb = fc
  .record({
    mnemonic: fc
      .array(fc.constantFrom(...SAMPLE_WORDS), { minLength: 12, maxLength: 12 })
      .map((words) => words.join(' ')),
    accounts: fc.constant([]),
    activeAccountIds: fc.constant({}),
  })
  .map((p): VaultPayload => p);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('vault encryption', () => {
  // **Feature: krypto-wallet, Property 1: Vault encryption round trip**
  it('round-trips: decrypt(encrypt(payload, pw), pw) === payload', async () => {
    await fc.assert(
      fc.asyncProperty(vaultPayloadArb, printableString, async (payload, password) => {
        const encrypted = await encryptVault(payload, password, PBKDF2_ITERATIONS_TEST);
        const recovered = await decryptVault(encrypted, password, PBKDF2_ITERATIONS_TEST);
        expect(recovered.mnemonic).toBe(payload.mnemonic);
        expect(recovered.accounts).toEqual(payload.accounts);
      }),
      { numRuns: 100 },
    );
  }, 60_000);

  // **Feature: krypto-wallet, Property 2: Wrong password yields INVALID_PASSWORD**
  it('throws INVALID_PASSWORD when decrypting with a different password', async () => {
    await fc.assert(
      fc.asyncProperty(
        vaultPayloadArb,
        printableString,
        printableString,
        async (payload, passwordA, passwordB) => {
          fc.pre(passwordA !== passwordB);

          const encrypted = await encryptVault(payload, passwordA, PBKDF2_ITERATIONS_TEST);

          try {
            await decryptVault(encrypted, passwordB, PBKDF2_ITERATIONS_TEST);
            expect.fail('Expected decryptVault to throw');
          } catch (err) {
            expect(err).toBeInstanceOf(KryptoError);
            expect((err as KryptoError).code).toBe('INVALID_PASSWORD');
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 60_000);

  it('produces different ciphertexts for the same payload (random IV/salt)', async () => {
    const payload: VaultPayload = {
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      accounts: [],
      activeAccountIds: {},
    };
    const password = 'test-password-123';
    const v1 = await encryptVault(payload, password, PBKDF2_ITERATIONS_TEST);
    const v2 = await encryptVault(payload, password, PBKDF2_ITERATIONS_TEST);
    // IV and salt must differ between calls
    expect(v1.iv).not.toBe(v2.iv);
    expect(v1.salt).not.toBe(v2.salt);
    expect(v1.ciphertext).not.toBe(v2.ciphertext);
  });

  it('stores vault version', async () => {
    const payload: VaultPayload = {
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      accounts: [],
      activeAccountIds: {},
    };
    const encrypted = await encryptVault(payload, 'pw', PBKDF2_ITERATIONS_TEST);
    expect(encrypted.version).toBe(1);
  });
});

