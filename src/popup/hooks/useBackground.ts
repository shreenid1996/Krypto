/**
 * Typed wrapper around chrome.runtime.sendMessage.
 * Returns a strongly-typed BackgroundResponse for any BackgroundRequest.
 */

import type { BackgroundRequest, BackgroundResponse } from '../../domain/messages';

/**
 * Sends a message to the background service worker and returns the response.
 * Throws if the Chrome runtime is unavailable (e.g. in tests).
 */
export async function sendToBackground<T = unknown>(
  request: BackgroundRequest,
): Promise<BackgroundResponse<T>> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(request, (response: BackgroundResponse<T>) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Convenience: sends a message and throws if the response is an error.
 * Returns the data payload on success.
 */
export async function sendOrThrow<T = unknown>(request: BackgroundRequest): Promise<T> {
  const response = await sendToBackground<T>(request);
  if (!response.success) {
    const { code, message } = response.error;
    const err = new Error(message) as Error & { code: string };
    err.code = code;
    throw err;
  }
  return response.data;
}
