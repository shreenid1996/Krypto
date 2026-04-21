/**
 * Screen router — renders the correct screen based on Zustand store state.
 * Bootstraps by fetching GET_SESSION_STATE from the background on mount.
 */

import React, { useEffect } from 'react';
import { useStore } from './store';
import { sendToBackground } from './hooks/useBackground';

// Lazy screen imports (will be created in tasks 10-16)
import Welcome from './screens/Welcome';
import CreateWallet from './screens/CreateWallet';
import VerifyRecoveryPhrase from './screens/VerifyRecoveryPhrase';
import ImportWallet from './screens/ImportWallet';
import Unlock from './screens/Unlock';
import Dashboard from './screens/Dashboard';
import Send from './screens/Send';
import Receive from './screens/Receive';
import ManageAccounts from './screens/ManageAccounts';
import Settings from './screens/Settings';
import Security from './screens/Security';

export default function Router() {
  const { screen, setScreen, setSession } = useStore();

  // Bootstrap: fetch session state from background on mount
  useEffect(() => {
    sendToBackground({ type: 'GET_SESSION_STATE' })
      .then((res) => {
        if (!res.success) {
          setScreen('welcome');
          return;
        }
        const data = res.data as {
          unlocked: boolean;
          hasWallet: boolean;
          accounts: import('../domain/types').DerivedAccount[];
          activeAccountIds: Partial<Record<import('../domain/types').Chain, string>>;
          activeChain: import('../domain/types').Chain;
        };
        setSession({
          unlocked: data.unlocked,
          hasWallet: data.hasWallet,
          accounts: data.accounts ?? [],
          activeAccountIds: data.activeAccountIds ?? {},
          activeChain: data.activeChain ?? 'solana',
        });
        if (!data.hasWallet) {
          setScreen('welcome');
        } else if (!data.unlocked) {
          setScreen('unlock');
        } else {
          setScreen('dashboard');
        }
      })
      .catch(() => setScreen('welcome'));
  }, []);

  if (screen === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-popup bg-surface">
        <div className="text-muted text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  switch (screen) {
    case 'welcome':          return <Welcome />;
    case 'create-wallet':    return <CreateWallet />;
    case 'verify-phrase':    return <VerifyRecoveryPhrase />;
    case 'import-wallet':    return <ImportWallet />;
    case 'unlock':           return <Unlock />;
    case 'dashboard':        return <Dashboard />;
    case 'send':             return <Send />;
    case 'receive':          return <Receive />;
    case 'manage-accounts':  return <ManageAccounts />;
    case 'settings':         return <Settings />;
    case 'security':         return <Security />;
    default:                 return <Welcome />;
  }
}
