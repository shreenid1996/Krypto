import React from 'react';
import { useStore } from '../store';

export default function Welcome() {
  const setScreen = useStore((s) => s.setScreen);
  return (
    <div className="flex flex-col items-center justify-center min-h-popup bg-surface px-6 gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-brand mb-2">Krypto</h1>
        <p className="text-muted text-sm">Your non-custodial multi-chain wallet</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => setScreen('create-wallet')}
          className="btn-primary w-full"
        >
          Create New Wallet
        </button>
        <button
          onClick={() => setScreen('import-wallet')}
          className="btn-secondary w-full"
        >
          Import Existing Wallet
        </button>
      </div>
    </div>
  );
}
