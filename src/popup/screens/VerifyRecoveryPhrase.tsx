import React, { useState, useMemo } from 'react';
import { useStore } from '../store';

export default function VerifyRecoveryPhrase() {
  const { pendingMnemonic, setPendingMnemonic, setScreen } = useStore();
  const words = useMemo(() => pendingMnemonic?.split(' ') ?? [], [pendingMnemonic]);

  // Pick 3 random word indices to verify
  const indices = useMemo(() => {
    const all = Array.from({ length: words.length }, (_, i) => i);
    const shuffled = all.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).sort((a, b) => a - b);
  }, [words.length]);

  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [error, setError] = useState('');

  function handleVerify() {
    setError('');
    for (const idx of indices) {
      if ((inputs[idx] ?? '').trim().toLowerCase() !== words[idx]) {
        setError(`Word #${idx + 1} is incorrect. Please check your recovery phrase.`);
        return;
      }
    }
    // Verification passed — go to dashboard
    setPendingMnemonic(null);
    setScreen('dashboard');
  }

  if (!pendingMnemonic) {
    setScreen('welcome');
    return null;
  }

  return (
    <div className="flex flex-col min-h-popup bg-surface px-5 py-6 gap-4">
      <button onClick={() => setScreen('create-wallet')} className="text-muted text-xs self-start">← Back</button>
      <h2 className="text-lg font-semibold text-white">Verify Recovery Phrase</h2>
      <p className="text-muted text-xs">Enter the requested words to confirm you've saved your phrase.</p>

      <div className="flex flex-col gap-3">
        {indices.map((idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <label className="text-xs text-muted">Word #{idx + 1}</label>
            <input
              type="text"
              value={inputs[idx] ?? ''}
              onChange={(e) => setInputs((prev) => ({ ...prev, [idx]: e.target.value }))}
              placeholder={`Word ${idx + 1}`}
              className="input"
              autoComplete="off"
              autoCapitalize="none"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button onClick={handleVerify} className="btn-primary mt-auto">
        Confirm & Continue
      </button>
    </div>
  );
}
