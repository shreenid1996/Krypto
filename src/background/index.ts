/**
 * Background service worker entry point (Manifest V3).
 *
 * Responsibilities:
 * - Route messages from the popup via handleMessage
 * - Implement auto-lock via chrome.alarms
 * - Handle SW restart: session is always locked on restart
 *
 * The session is purely in-memory. On SW restart (which MV3 can do at any
 * time), all decrypted secrets are gone and the wallet is effectively locked.
 */

import { handleMessage, clearCachedPassword } from './message-router';
import { lock, isUnlocked } from './wallet-service';
import { getSettings } from './settings-service';
import type { BackgroundRequest } from '../domain/messages';

const AUTO_LOCK_ALARM = 'krypto-auto-lock';

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    // Must return true to keep the message channel open for async response
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => {
        sendResponse({ success: false, error: { code: 'NETWORK_ERROR', message: String(err) } });
      });
    return true;
  },
);

// ─── Auto-lock via chrome.alarms ──────────────────────────────────────────────

/**
 * Schedules (or reschedules) the auto-lock alarm based on current settings.
 * Called after unlock and after settings change.
 */
export async function scheduleAutoLock(): Promise<void> {
  await chrome.alarms.clear(AUTO_LOCK_ALARM);

  const settings = await getSettings();
  if (settings.autoLockMinutes === 0) return; // 0 = never

  chrome.alarms.create(AUTO_LOCK_ALARM, {
    delayInMinutes: settings.autoLockMinutes,
  });
}

/**
 * Cancels the auto-lock alarm (called on manual lock).
 */
export async function cancelAutoLock(): Promise<void> {
  await chrome.alarms.clear(AUTO_LOCK_ALARM);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_LOCK_ALARM) {
    if (isUnlocked()) {
      lock();
      clearCachedPassword();
    }
  }
});

// ─── Activity tracking ────────────────────────────────────────────────────────
// Reset the auto-lock timer on any popup activity by rescheduling the alarm
// whenever a message is received and the wallet is unlocked.

chrome.runtime.onMessage.addListener(() => {
  if (isUnlocked()) {
    scheduleAutoLock().catch(() => {});
  }
  // Return false — this listener doesn't send a response
  return false;
});

// ─── SW install / startup ─────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  // Nothing to do on install — vault is created via CREATE_WALLET message
});

// On SW startup the session is always locked (in-memory state is gone).
// The popup will detect this via GET_SESSION_STATE and show the Unlock screen.
// No explicit action needed here.

// ─── Keep-alive for long operations ──────────────────────────────────────────
// MV3 service workers can be terminated after ~30s of inactivity.
// For long crypto operations (PBKDF2 at 210k iterations) we use a port
// to keep the SW alive during the operation.

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'krypto-keepalive') {
    port.onDisconnect.addListener(() => {
      // Port closed — SW can sleep again
    });
  }
});
