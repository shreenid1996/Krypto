/**
 * Chain adapter registry.
 * Provides a single lookup point for all ChainAdapter implementations.
 */

import type { Chain } from '../../domain/types';
import type { ChainAdapter } from '../../domain/chain-adapter';
import { solanaAdapter } from './solana/adapter';
import { ethereumAdapter } from './ethereum/adapter';
import { bitcoinAdapter } from './bitcoin/adapter';

export const adapters: Record<Chain, ChainAdapter> = {
  solana: solanaAdapter,
  ethereum: ethereumAdapter,
  bitcoin: bitcoinAdapter,
};

/**
 * Returns the ChainAdapter for the given chain.
 */
export function getAdapter(chain: Chain): ChainAdapter {
  return adapters[chain];
}

export { solanaAdapter, ethereumAdapter, bitcoinAdapter };
