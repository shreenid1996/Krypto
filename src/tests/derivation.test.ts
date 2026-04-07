/**
 * HD derivation tests — known vectors and determinism property.
 *
 * Known vectors use the standard BIP-39 all-zeros test mnemonic:
 *   "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
 *
 * Property 6: HD derivation produces deterministic addresses
 *   **Feature: krypto-wallet, Property 6: HD derivation produces deterministic addresses**
 *   Validates: Requirements 3.4, 3.5, 3.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { deriveEthereumAccount } from '../lib/chains/ethereum/derive';
import { deriveSolanaAccount } from '../lib/chains/solana/derive';
import { deriveBitcoinAccount } from '../lib/chains/bitcoin/derive';
import { generateMnemonic } from '../lib/crypto/mnemonic';

// ─── Standard BIP-39 test mnemonic ───────────────────────────────────────────
// 128-bit entropy, all-zeros: well-known test vector used across the ecosystem
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// ─── Known-vector tests (task 4.3) ───────────────────────────────────────────

describe('Ethereum derivation — known vectors', () => {
  it('derives the correct address at index 0 (m/44\'/60\'/0\'/0/0)', async () => {
    const account = await deriveEthereumAccount(TEST_MNEMONIC, 0);
    expect(account.address).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(account.chain).toBe('ethereum');
    expect(account.index).toBe(0);
  });

  it('derives the correct address at index 1 (m/44\'/60\'/0\'/0/1)', async () => {
    const account = await deriveEthereumAccount(TEST_MNEMONIC, 1);
    expect(account.address).toBe('0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0');
    expect(account.index).toBe(1);
  });
});

describe('Solana derivation — known vectors', () => {
  it('derives the correct address at index 0 (m/44\'/501\'/0\'/0\')', async () => {
    const account = await deriveSolanaAccount(TEST_MNEMONIC, 0);
    expect(account.address).toBe('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    expect(account.chain).toBe('solana');
    expect(account.index).toBe(0);
  });

  it('derives the correct address at index 1 (m/44\'/501\'/1\'/0\')', async () => {
    const account = await deriveSolanaAccount(TEST_MNEMONIC, 1);
    expect(account.address).toBe('Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb');
    expect(account.index).toBe(1);
  });
});

describe('Bitcoin derivation — known vectors', () => {
  it('derives a native SegWit bc1 address at index 0 (m/84\'/0\'/0\'/0/0)', async () => {
    const account = await deriveBitcoinAccount(TEST_MNEMONIC, 0);
    // Known bc1 address for this mnemonic at m/84'/0'/0'/0/0
    expect(account.address).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
    expect(account.chain).toBe('bitcoin');
    expect(account.index).toBe(0);
  });

  it('derives a native SegWit bc1 address at index 1', async () => {
    const account = await deriveBitcoinAccount(TEST_MNEMONIC, 1);
    expect(account.address).toMatch(/^bc1q/);
    expect(account.index).toBe(1);
  });
});

// ─── Determinism property (task 4.4) ─────────────────────────────────────────

describe('HD derivation determinism', () => {
  // **Feature: krypto-wallet, Property 6: HD derivation produces deterministic addresses**
  it('Ethereum: same mnemonic + index always yields the same address', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 9 }),
        async (index) => {
          const mnemonic = generateMnemonic();
          const a = await deriveEthereumAccount(mnemonic, index);
          const b = await deriveEthereumAccount(mnemonic, index);
          expect(a.address).toBe(b.address);
          expect(a.chain).toBe(b.chain);
          expect(a.index).toBe(b.index);
        },
      ),
      { numRuns: 20 },
    );
  }, 30_000);

  it('Solana: same mnemonic + index always yields the same address', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 9 }),
        async (index) => {
          const mnemonic = generateMnemonic();
          const a = await deriveSolanaAccount(mnemonic, index);
          const b = await deriveSolanaAccount(mnemonic, index);
          expect(a.address).toBe(b.address);
        },
      ),
      { numRuns: 20 },
    );
  }, 30_000);

  it('Bitcoin: same mnemonic + index always yields the same address', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 9 }),
        async (index) => {
          const mnemonic = generateMnemonic();
          const a = await deriveBitcoinAccount(mnemonic, index);
          const b = await deriveBitcoinAccount(mnemonic, index);
          expect(a.address).toBe(b.address);
        },
      ),
      { numRuns: 20 },
    );
  }, 30_000);

  it('different indices produce different addresses', async () => {
    const mnemonic = TEST_MNEMONIC;
    const eth0 = await deriveEthereumAccount(mnemonic, 0);
    const eth1 = await deriveEthereumAccount(mnemonic, 1);
    expect(eth0.address).not.toBe(eth1.address);

    const sol0 = await deriveSolanaAccount(mnemonic, 0);
    const sol1 = await deriveSolanaAccount(mnemonic, 1);
    expect(sol0.address).not.toBe(sol1.address);

    const btc0 = await deriveBitcoinAccount(mnemonic, 0);
    const btc1 = await deriveBitcoinAccount(mnemonic, 1);
    expect(btc0.address).not.toBe(btc1.address);
  });
});
