/**
 * Mnemonic generation and validation tests.
 *
 * Property 3: Generated mnemonics are valid BIP-39
 *   **Feature: krypto-wallet, Property 3: Generated mnemonics are valid BIP-39**
 *   Validates: Requirements 3.1
 *
 * Property 4: Invalid inputs fail mnemonic validation
 *   **Feature: krypto-wallet, Property 4: Invalid inputs fail mnemonic validation**
 *   Validates: Requirements 3.2, 3.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as bip39 from 'bip39';
import { generateMnemonic, validateMnemonic } from '../lib/crypto/mnemonic';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('mnemonic generation', () => {
  // **Feature: krypto-wallet, Property 3: Generated mnemonics are valid BIP-39**
  it('generateMnemonic always produces a valid 12-word BIP-39 phrase', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999 }), () => {
        const mnemonic = generateMnemonic();
        const words = mnemonic.trim().split(/\s+/);

        // Must be 12 words
        expect(words).toHaveLength(12);

        // Every word must be in the BIP-39 English wordlist
        const wordlist = bip39.wordlists.english;
        for (const word of words) {
          expect(wordlist).toContain(word);
        }

        // Must pass full BIP-39 checksum validation
        expect(bip39.validateMnemonic(mnemonic)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('generates unique mnemonics each call', () => {
    const a = generateMnemonic();
    const b = generateMnemonic();
    expect(a).not.toBe(b);
  });
});

describe('mnemonic validation', () => {
  it('accepts known-good 12-word mnemonics', () => {
    const valid = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    expect(validateMnemonic(valid)).toBe(true);
  });

  it('accepts known-good 24-word mnemonics', () => {
    const valid =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
    expect(validateMnemonic(valid)).toBe(true);
  });

  // **Feature: krypto-wallet, Property 4: Invalid inputs fail mnemonic validation**
  it('rejects strings that are not valid BIP-39 mnemonics', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Random short strings
          fc.string({ minLength: 0, maxLength: 30 }),
          // Wrong word count (not 12 or 24)
          fc.array(fc.string({ minLength: 2, maxLength: 8 }), { minLength: 1, maxLength: 11 })
            .map((words) => words.join(' ')),
          fc.array(fc.string({ minLength: 2, maxLength: 8 }), { minLength: 13, maxLength: 23 })
            .map((words) => words.join(' ')),
          // 12 words but not from the BIP-39 wordlist
          fc.array(
            fc.string({ minLength: 3, maxLength: 8 }).filter((w) => !bip39.wordlists.english.includes(w)),
            { minLength: 12, maxLength: 12 },
          ).map((words) => words.join(' ')),
        ),
        (input) => {
          // All of these should fail validation
          expect(validateMnemonic(input)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('rejects empty string', () => {
    expect(validateMnemonic('')).toBe(false);
  });

  it('rejects mnemonic with invalid checksum', () => {
    // Valid words but wrong checksum (last word changed)
    const badChecksum = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon zoo';
    expect(validateMnemonic(badChecksum)).toBe(false);
  });
});
