/**
 * Address validation tests — Property 5.
 *
 * Property 5: Address validation correctness per chain
 *   **Feature: krypto-wallet, Property 5: Address validation correctness per chain**
 *   Validates: Requirements 5.2, 5.3, 5.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { solanaAdapter } from '../lib/chains/solana/adapter';
import { ethereumAdapter } from '../lib/chains/ethereum/adapter';
import { bitcoinAdapter } from '../lib/chains/bitcoin/adapter';

// ─── Known-good addresses ─────────────────────────────────────────────────────

const VALID_SOL = [
  'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
  '11111111111111111111111111111111',
  'So11111111111111111111111111111111111111112',
];

const VALID_ETH = [
  '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0',
  '0x0000000000000000000000000000000000000000',
];

const VALID_BTC = [
  'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
  'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
];

// ─── Known-bad addresses ──────────────────────────────────────────────────────

const INVALID_ADDRESSES = [
  '',
  'not-an-address',
  '0x',
  'bc1',
  '1BpEi6DfDAUFd153wiGrvkiKW1iHyrx7ah', // P2PKH (not native SegWit)
  '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', // P2SH (not native SegWit)
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // too long
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Solana address validation', () => {
  it('accepts known-good Solana addresses', () => {
    for (const addr of VALID_SOL) {
      expect(solanaAdapter.validateAddress(addr), `should accept ${addr}`).toBe(true);
    }
  });

  it('rejects known-bad addresses', () => {
    for (const addr of INVALID_ADDRESSES) {
      expect(solanaAdapter.validateAddress(addr), `should reject ${addr}`).toBe(false);
    }
    // ETH and BTC addresses are not valid Solana addresses
    for (const addr of [...VALID_ETH, ...VALID_BTC]) {
      expect(solanaAdapter.validateAddress(addr), `should reject ${addr}`).toBe(false);
    }
  });
});

describe('Ethereum address validation', () => {
  it('accepts known-good Ethereum addresses', () => {
    for (const addr of VALID_ETH) {
      expect(ethereumAdapter.validateAddress(addr), `should accept ${addr}`).toBe(true);
    }
  });

  it('rejects known-bad addresses', () => {
    for (const addr of INVALID_ADDRESSES) {
      expect(ethereumAdapter.validateAddress(addr), `should reject ${addr}`).toBe(false);
    }
    // BTC addresses are not valid ETH addresses
    for (const addr of VALID_BTC) {
      expect(ethereumAdapter.validateAddress(addr), `should reject ${addr}`).toBe(false);
    }
  });
});

describe('Bitcoin address validation', () => {
  it('accepts known-good native SegWit (bc1q) addresses', () => {
    for (const addr of VALID_BTC) {
      expect(bitcoinAdapter.validateAddress(addr), `should accept ${addr}`).toBe(true);
    }
  });

  it('rejects known-bad addresses', () => {
    for (const addr of INVALID_ADDRESSES) {
      expect(bitcoinAdapter.validateAddress(addr), `should reject ${addr}`).toBe(false);
    }
    // ETH and SOL addresses are not valid BTC addresses
    for (const addr of [...VALID_ETH, ...VALID_SOL]) {
      expect(bitcoinAdapter.validateAddress(addr), `should reject ${addr}`).toBe(false);
    }
  });
});

// **Feature: krypto-wallet, Property 5: Address validation correctness per chain**
describe('Address validation — cross-chain rejection property', () => {
  it('random strings are rejected by all three adapters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter(
          (s) =>
            !VALID_SOL.includes(s) &&
            !VALID_ETH.includes(s) &&
            !VALID_BTC.includes(s),
        ),
        (randomStr) => {
          // A random string should not be a valid address on all three chains simultaneously
          const validOnAll =
            solanaAdapter.validateAddress(randomStr) &&
            ethereumAdapter.validateAddress(randomStr) &&
            bitcoinAdapter.validateAddress(randomStr);
          expect(validOnAll).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});
