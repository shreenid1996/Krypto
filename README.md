# Krypto Wallet

A non-custodial multi-chain Chrome extension wallet supporting **Solana**, **Ethereum**, and **Bitcoin**.

Built with React, TypeScript, Vite, Tailwind CSS, and Manifest V3.

---

## Prerequisites

- Node.js 18+
- npm 9+

---

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Build the extension
npm run build
```

The built extension will be in the `dist/` folder.

---

## Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `Krypto/dist` folder

The Krypto icon will appear in your Chrome toolbar.

---

## Development (watch mode)

```bash
npm run dev
```

This rebuilds on file changes. Reload the extension in `chrome://extensions` after each build.

---

## Tests

```bash
npm test
```

Uses Vitest + fast-check for unit and property-based tests.

---

## Project Structure

```
src/
  background/     # Service worker — vault ops, message router, auto-lock
  popup/          # React popup UI — screens, store, hooks
  content/        # Content script (injected into pages)
  injected/       # window.krypto provider scaffold
  lib/
    crypto/       # Vault encryption, mnemonic utilities
    chains/       # Chain adapters (solana, ethereum, bitcoin)
    storage/      # IndexedDB + chrome.storage wrappers
  domain/         # Shared types, errors, message protocol
  utils/          # Shared helpers
  tests/          # Vitest test suite
```

---

## Security Notes

- Mnemonic and private keys are **never** sent to any server.
- The vault is encrypted with AES-GCM using a PBKDF2-derived key (210,000 iterations).
- Decrypted secrets live in memory only while the wallet is unlocked.
- The wallet auto-locks after a configurable idle timeout.
