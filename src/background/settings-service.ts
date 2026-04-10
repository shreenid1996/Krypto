/**
 * SettingsService — reads and writes UserSettings via chrome.storage.local.
 * Thin wrapper around the storage layer with typed access.
 */

import type { UserSettings } from '../domain/types';
import { loadSettings, patchSettings, saveSettings } from '../lib/storage/settings';

export async function getSettings(): Promise<UserSettings> {
  return loadSettings();
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  return patchSettings(patch);
}

export async function resetSettings(): Promise<void> {
  const { DEFAULT_SETTINGS } = await import('../domain/types');
  await saveSettings(DEFAULT_SETTINGS);
}
