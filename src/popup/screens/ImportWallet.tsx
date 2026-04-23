import React, { useState } from 'react';
import { useStore } from '../store';
import { sendOrThrow } from '../hooks/useBackground';
import PasswordInput from '../components/PasswordInput';
import type { ImportWalletResult } from '../../domain/messages';

export default function ImportWallet() {
  const { setScreen, setSession, activeChain } = useStore();
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    setError('');
    const trimmed = mnemonic.trim().replace(/\s+/g, ' ');
    if (!trimmed) { setError('Please enter your recovery phrase.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const result = await sendOrThrow<ImportWalletResult>({
        type: 'IMPORT_WALLET',
        mnemonic: trimmed,
        password,
      });
      setSession({
        unlocked: true,
        hasWallet: true,
        accounts: result.accounts,
        activeAccountIds: Object.fromEntries(result.accounts.map((a) => [a.chain, a.id])),
        activeChain,
      });
      setScreen('dashboard');
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === 'INVALID_MNEMONIC') {
        setError('Invalid recovery phrase. Please check each word and try again.');
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-popup bg-surface px-5 py-6 gap-4">
      <button onClick={() => setScreen('welcome')} className="text-muted text-xs self-start">← Back</button>
      <h2 className="text-lg font-semibold text-white">Import Wallet</h2>
      <p className="text-muted text-xs">Enter your 12 or 24-word recovery phrase to restore your wallet.</p>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted">Recovery Phrase</label>
        <textarea
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
          placeholder="word1 word2 word3 … word12"
          rows={3}
          className="input resize-none font-mono text-sm"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>

      <PasswordInput value={password} onChange={setPassword} label="New Password (min 8 chars)" />
      <PasswordInput value={confirm} onChange={setConfirm} label="Confirm Password" />

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={handleImport}
        disabled={loading}
        className="btn-primary mt-auto disabled:opacity-50"
      >
        {loading ? 'Importing…' : 'Import Wallet'}
      </button>
    </div>
  );
}
