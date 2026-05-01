import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../store';
import { sendOrThrow, sendToBackground } from '../hooks/useBackground';
import type { Chain, DerivedAccount } from '../../domain/types';
import type { BalanceResult } from '../../domain/messages';

// ─── Chain config ─────────────────────────────────────────────────────────────

const CHAIN_LABELS: Record<Chain, string> = {
  solana: 'SOL',
  ethereum: 'ETH',
  bitcoin: 'BTC',
};

const CHAIN_COLORS: Record<Chain, string> = {
  solana: 'text-purple-400',
  ethereum: 'text-blue-400',
  bitcoin: 'text-orange-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// ─── Balance hook ─────────────────────────────────────────────────────────────

function useBalance(chain: Chain, address: string | undefined) {
  return useQuery({
    queryKey: ['balance', chain, address],
    queryFn: async () => {
      if (!address) return null;
      const result = await sendOrThrow<BalanceResult>({
        type: 'GET_BALANCE',
        chain,
        address,
      });
      return result;
    },
    enabled: !!address,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

// ─── Lock handler ─────────────────────────────────────────────────────────────

async function handleLock(setScreen: (s: import('../store').Screen) => void, setSession: (s: Parameters<import('../store').KryptoStore['setSession']>[0]) => void) {
  await sendToBackground({ type: 'LOCK' });
  setSession({ unlocked: false, hasWallet: true, accounts: [], activeAccountIds: {}, activeChain: 'solana' });
  setScreen('unlock');
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { activeChain, setActiveChain, accounts, activeAccountIds, setScreen, setSession } = useStore();

  const activeAccount: DerivedAccount | undefined = accounts.find(
    (a) => a.chain === activeChain && a.id === activeAccountIds[activeChain] && !a.hidden,
  ) ?? accounts.find((a) => a.chain === activeChain && !a.hidden);

  const { data: balanceData, isLoading: balanceLoading } = useBalance(activeChain, activeAccount?.address);

  const chains: Chain[] = ['solana', 'ethereum', 'bitcoin'];

  return (
    <div className="flex flex-col min-h-popup bg-surface text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-brand font-bold text-lg">Krypto</span>
        <div className="flex gap-2">
          <button
            onClick={() => setScreen('manage-accounts')}
            className="text-muted text-xs hover:text-white transition-colors"
            title="Manage Accounts"
          >
            Accounts
          </button>
          <button
            onClick={() => setScreen('settings')}
            className="text-muted text-xs hover:text-white transition-colors"
            title="Settings"
          >
            ⚙
          </button>
          <button
            onClick={() => handleLock(setScreen, setSession)}
            className="text-muted text-xs hover:text-red-400 transition-colors"
            title="Lock"
          >
            🔒
          </button>
        </div>
      </div>

      {/* Chain tabs */}
      <div className="flex border-b border-surface-2 px-4">
        {chains.map((chain) => (
          <button
            key={chain}
            onClick={() => setActiveChain(chain)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeChain === chain
                ? `border-brand ${CHAIN_COLORS[chain]}`
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {CHAIN_LABELS[chain]}
          </button>
        ))}
      </div>

      {/* Account card */}
      <div className="mx-4 mt-4 bg-surface-2 rounded-xl p-4">
        {activeAccount ? (
          <>
            {/* Account selector */}
            <button
              onClick={() => setScreen('manage-accounts')}
              className="flex items-center gap-1 text-xs text-muted hover:text-white mb-3"
            >
              <span className="font-medium text-white">{activeAccount.name}</span>
              <span>▾</span>
            </button>

            {/* Address */}
            <p className="font-mono text-xs text-muted mb-4">
              {truncateAddress(activeAccount.address)}
            </p>

            {/* Balance */}
            <div className="text-center mb-4">
              {balanceLoading ? (
                <p className="text-2xl font-bold text-muted animate-pulse">—</p>
              ) : balanceData ? (
                <p className="text-2xl font-bold text-white">{balanceData.balanceHuman}</p>
              ) : (
                <p className="text-2xl font-bold text-muted">0.00 {CHAIN_LABELS[activeChain]}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setScreen('send')}
                className="btn-primary flex-1 text-sm"
              >
                Send
              </button>
              <button
                onClick={() => setScreen('receive')}
                className="btn-secondary flex-1 text-sm"
              >
                Receive
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted text-sm">No account for {CHAIN_LABELS[activeChain]}</p>
            <button
              onClick={() => setScreen('manage-accounts')}
              className="btn-primary mt-3 text-xs"
            >
              Add Account
            </button>
          </div>
        )}
      </div>

      {/* Recent activity placeholder */}
      <div className="mx-4 mt-4 flex-1">
        <p className="text-xs text-muted mb-2">Recent Activity</p>
        <div className="bg-surface-2 rounded-xl p-4 text-center">
          <p className="text-muted text-xs">No recent transactions</p>
        </div>
      </div>

      {/* Bottom padding */}
      <div className="h-4" />
    </div>
  );
}
