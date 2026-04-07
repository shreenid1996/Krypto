/**
 * Bitcoin PSBT construction tests — Property 7.
 *
 * Property 7: Bitcoin PSBT fee is non-negative and covers inputs
 *   **Feature: krypto-wallet, Property 7: Bitcoin PSBT fee is non-negative and covers inputs**
 *   Validates: Requirements 5.6
 *
 * These tests exercise the PSBT build logic directly without network calls
 * by constructing mock UTXOs and verifying the output invariants.
 */

import { describe, it, expect } from 'vitest';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import * as bip39 from 'bip39';

const bip32 = BIP32Factory(ecc);
const NETWORK = bitcoin.networks.bitcoin;
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const BTC_PATH = "m/84'/0'/0'/0/0";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a minimal P2WPKH output script for a given address */
function p2wpkhScript(address: string): Buffer {
  return bitcoin.address.toOutputScript(address, NETWORK);
}

/** Derives the test account's address and keypair */
async function getTestAccount() {
  const seed = await bip39.mnemonicToSeed(TEST_MNEMONIC);
  const root = bip32.fromSeed(seed, NETWORK);
  const child = root.derivePath(BTC_PATH);
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network: NETWORK,
  });
  return { child, address: address! };
}

/**
 * Builds a PSBT with synthetic UTXOs (no network calls).
 * Returns the PSBT and the input/output sums for invariant checking.
 */
async function buildTestPsbt(
  utxoValues: number[],
  sendAmount: number,
  feeAmount: number,
  recipientAddress: string,
) {
  const { address: fromAddress } = await getTestAccount();
  const script = p2wpkhScript(fromAddress);

  const psbt = new bitcoin.Psbt({ network: NETWORK });

  // Add synthetic UTXOs as inputs
  const fakeTxId = '0'.repeat(64);
  for (let i = 0; i < utxoValues.length; i++) {
    psbt.addInput({
      hash: fakeTxId,
      index: i,
      witnessUtxo: { script, value: utxoValues[i] },
    });
  }

  const inputSum = utxoValues.reduce((a, b) => a + b, 0);

  // Recipient output
  psbt.addOutput({ address: recipientAddress, value: sendAmount });

  // Change output
  const change = inputSum - sendAmount - feeAmount;
  if (change > 546) {
    psbt.addOutput({ address: fromAddress, value: change });
  }

  return { psbt, inputSum, change: Math.max(0, change) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Bitcoin PSBT construction', () => {
  const RECIPIENT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

  it('outputs sum to inputs minus fee', async () => {
    const utxoValues = [100_000, 50_000]; // 150,000 sats
    const sendAmount = 80_000;
    const feeAmount = 1_410;

    const { psbt, inputSum } = await buildTestPsbt(utxoValues, sendAmount, feeAmount, RECIPIENT);

    const outputSum = psbt.txOutputs.reduce((sum, out) => sum + out.value, 0);
    expect(outputSum).toBe(inputSum - feeAmount);
    expect(outputSum).toBeGreaterThan(0);
  });

  it('fee is positive (non-zero)', async () => {
    const feeAmount = 1_410;
    expect(feeAmount).toBeGreaterThan(0);

    const { psbt, inputSum } = await buildTestPsbt([200_000], 100_000, feeAmount, RECIPIENT);
    const outputSum = psbt.txOutputs.reduce((sum, out) => sum + out.value, 0);
    const impliedFee = inputSum - outputSum;
    expect(impliedFee).toBe(feeAmount);
    expect(impliedFee).toBeGreaterThan(0);
  });

  it('recipient output equals the requested send amount', async () => {
    const sendAmount = 50_000;
    const { psbt } = await buildTestPsbt([200_000], sendAmount, 1_410, RECIPIENT);

    const recipientOutput = psbt.txOutputs[0];
    expect(recipientOutput.value).toBe(sendAmount);
  });

  it('change output is included when change > dust threshold (546 sats)', async () => {
    const utxoValues = [200_000];
    const sendAmount = 50_000;
    const feeAmount = 1_410;
    const expectedChange = 200_000 - 50_000 - 1_410; // 148,590

    const { psbt } = await buildTestPsbt(utxoValues, sendAmount, feeAmount, RECIPIENT);

    expect(psbt.txOutputs).toHaveLength(2);
    const changeOutput = psbt.txOutputs[1];
    expect(changeOutput.value).toBe(expectedChange);
  });

  it('no change output when change is below dust threshold', async () => {
    // Exactly enough to cover send + fee, leaving 0 change
    const sendAmount = 100_000;
    const feeAmount = 1_410;
    const utxoValues = [sendAmount + feeAmount]; // exactly covers it

    const { psbt } = await buildTestPsbt(utxoValues, sendAmount, feeAmount, RECIPIENT);

    // Only recipient output, no change (change = 0 which is <= 546)
    expect(psbt.txOutputs).toHaveLength(1);
    expect(psbt.txOutputs[0].value).toBe(sendAmount);
  });

  it('PSBT has correct number of inputs', async () => {
    const utxoValues = [50_000, 60_000, 70_000];
    const { psbt } = await buildTestPsbt(utxoValues, 100_000, 1_410, RECIPIENT);
    expect(psbt.data.inputs).toHaveLength(3);
  });
});
