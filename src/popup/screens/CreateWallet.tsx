import React, { useState } from 'react';
import { useStore } from '../store';
import { sendOrThrow } from '../hooks/useBackground';
import PasswordInput from '../components/PasswordInput';
import type { CreateWalletResult } from '../../domain/messages';

type Step = 'password' | 'mnemonic';

export default function CreateWallet() {
  const { setScreen, setPendingMnemonic } = useStore();
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const result = await sendOrThrow<CreateWalletResult>({ type: 'CREATE_WALLET', password });
      setMnemonic(result.mnemonic);
      setPendingMnemonic(result.mnemonic);
      setStep('mnemonic');
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleContinue() {
    setScreen('verify-phrase');
  }

  function handleBack() {
    setPendingMnemonic(null);
    setScreen('welcome');
  }

  if (step === 'mnemonic') {
    const words = mnemonic.split(' ');
    return (
      <div className="flex flex-col min-h-popup bg-surface px-5 py-6 gap-4">
        <button onClick={handleBack} className="text-muted text-xs self-start">← Back</button>
        <h2 className="text-lg font-semibold text-white">Your Recovery Phrase</h2>
        <p className="text-muted text-xs">Write these 12 words down in order and store them safely. Never share them.</p>
        <div className="grid grid-cols-3 gap-2">
          {words.map((word, i) => (
            <div key={i} className="bg-surface-2 rounded-lg px-2 py-1.5 text-xs text-white flex gap-1.5">
              <span className="text-muted">{i + 1}.</span>
              <span className="font-mono">{word}</span>
            </div>
          ))}
        </div>
        <p className="text-yellow-400 text-xs">⚠ Anyone with this phrase can access your wallet.</p>
        <button onClick={handleContinue} className="btn-primary mt-auto">
          I've Written It Down
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-popup bg-surface px-5 py-6 gap-4">
      <button onClick={handleBack} className="text-muted text-xs self-start">← Back</button>
      <h2 className="text-lg font-semibold text-white">Create Wallet</h2>
      <p className="text-muted text-xs">Choose a strong password to protect your wallet on this device.</p>
      <PasswordInput value={password} onChange={setPassword} label="Password (min 8 chars)" />
      <PasswordInput value={confirm} onChange={setConfirm} label="Confirm Password" />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={handleCreate}
        disabled={loading}
        className="btn-primary mt-auto disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Create Wallet'}
      </button>
    </div>
  );
}
