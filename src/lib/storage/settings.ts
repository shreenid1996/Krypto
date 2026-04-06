/**
 * chrome.storage.local wrapper for non-sensitive UserSettings.
 * Falls back to DEFAULT_SETTINGS when no settings are stored yet.
 */

import { DEFAULT_SETTINGS, type UserSettings } from '../../domain/types';

const SETTINGS_KEY = 'krypto-settings';

/** Reads UserSettings from chrome.storage.local. */
export async function loadSettings(): Promise<UserSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (result) => {
      const stored = result[SETTINGS_KEY] as Partial<UserSettings> | undefined;
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

/** Persists UserSettings to chrome.storage.local. */
export async function saveSettings(settings: UserSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: settings }, resolve);
  });
}

/** Merges a partial patch into the stored settings. */
export async function patchSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await loadSettings();
  const updated = { ...current, ...patch };
  await saveSettings(updated);
  return updated;
}
