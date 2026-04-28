import React, { useState } from 'react';
import { useStore } from '../store';
import { sendOrThrow } from '../hooks/useBackground';
import PasswordInput from '../components/PasswordInput';
import type { DerivedAccount, Chain } from '../../domain/types';

interface UnlockResult {
  unlocked: boolean;
  accounts: DerivedAccount[];
  activeAccountIds: Partial<Record<Chain, string>>;
  activeChain: Chain;
}

export default function Unlock() {
  const { setScreen, setSession } = useStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true);
    try {
      const result = await sendOrThrow<UnlockResult>({ type: 'UNLOCK', password });
      setSession({
        unlocked: true,
        hasWallet: true,
        accounts: result.accounts,
        activeAccountIds: result.activeAccountIds,
        activeChain: result.activeChain,
      });
      setScreen('dashboard');
    } catch (err: unknown) {
      const e2 = err as Error & { code?: string };
      if (e2.code === 'INVALID_PASSWORD') {
        setError('Incorrect password. Please try again.');
      } else {
        setError(e2.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-popup bg-surface px-6 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-brand mb-1">Krypto</h1>
        <p className="text-muted text-xs">Enter your password to unlock</p>
      </div>

      <form onSubmit={handleUnlock} className="flex flex-col gap-3 w-full max-w-xs">
        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder="Password"
          label="Password"
        />

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
