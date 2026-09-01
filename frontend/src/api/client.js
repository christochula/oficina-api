import { runtimeConfig } from '../core/config.js';
import { sessionStore } from '../core/session.js';
import { refreshOperatorSession } from './auth.js';
import { createHttpClient } from './http.js';

function announceExpiredSession(error) {
  if (
    typeof globalThis.dispatchEvent === 'function' &&
    typeof globalThis.CustomEvent === 'function'
  ) {
    globalThis.dispatchEvent(
      new CustomEvent('oficina:session-expired', {
        detail: { correlationId: error.correlationId },
      }),
    );
  }
}

export function createApiClient(options = {}) {
  return createHttpClient({
    baseUrl: runtimeConfig.apiBaseUrl,
    timeoutMs: runtimeConfig.requestTimeoutMs,
    getSession: () => sessionStore.get(),
    refreshSession: refreshOperatorSession,
    clearSession: (reason) => sessionStore.clear(reason),
    onUnauthorized: announceExpiredSession,
    ...options,
  });
}

export const apiClient = createApiClient();
