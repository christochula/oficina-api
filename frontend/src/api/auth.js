import { runtimeConfig } from '../core/config.js';
import {
  canRefreshOperatorSession,
  SESSION_KIND,
  sessionStore,
} from '../core/session.js';
import { ApiError } from './errors.js';
import { API_ENDPOINTS } from './endpoints.js';
import { createHttpClient } from './http.js';

const operatorAuthClient = createHttpClient({
  baseUrl: runtimeConfig.apiBaseUrl,
  timeoutMs: runtimeConfig.requestTimeoutMs,
});

const clientAuthClient = createHttpClient({
  baseUrl: runtimeConfig.clientAuthBaseUrl,
  timeoutMs: runtimeConfig.requestTimeoutMs,
});

export async function loginOperator({ email, senha }) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail || typeof senha !== 'string' || !senha) {
    throw new TypeError('Informe e-mail e senha.');
  }

  const tokens = await operatorAuthClient.post(
    API_ENDPOINTS.auth.login,
    { email: normalizedEmail, senha },
    { auth: false },
  );
  return sessionStore.setOperator(tokens);
}

export async function loginClient({ cpf }) {
  if (typeof cpf !== 'string' || !cpf.trim()) {
    throw new TypeError('Informe o CPF.');
  }

  try {
    const tokenResponse = await clientAuthClient.post(
      API_ENDPOINTS.auth.clientToken,
      { cpf: cpf.trim() },
      { auth: false },
    );
    return sessionStore.setClient(tokenResponse);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError('Não foi possível autenticar.', {
        status: 401,
        code: error.code,
        correlationId: error.correlationId,
      });
    }
    throw error;
  }
}

export async function refreshOperatorSession(currentSession = sessionStore.get()) {
  if (!canRefreshOperatorSession(currentSession)) {
    throw new ApiError('A sessão da equipe não pode mais ser renovada.', {
      status: 401,
      code: 'REFRESH_UNAVAILABLE',
    });
  }

  const tokens = await operatorAuthClient.post(
    API_ENDPOINTS.auth.refresh,
    undefined,
    {
      auth: false,
      token: currentSession.refreshToken,
      retryOnUnauthorized: false,
    },
  );
  return sessionStore.updateOperatorTokens(tokens);
}

export async function logoutCurrentSession() {
  let currentSession = sessionStore.get();
  let remoteLogout = false;

  try {
    if (currentSession?.kind === SESSION_KIND.OPERATOR) {
      if (
        currentSession.accessExpiresAt !== null &&
        currentSession.accessExpiresAt <= Date.now() &&
        canRefreshOperatorSession(currentSession)
      ) {
        currentSession = await refreshOperatorSession(currentSession);
      }
      await operatorAuthClient.post(API_ENDPOINTS.auth.logout, undefined, {
        auth: false,
        token: currentSession.accessToken,
        retryOnUnauthorized: false,
      });
      remoteLogout = true;
    }
  } catch {
    // O logout local é obrigatório mesmo sem conectividade ou token válido.
  } finally {
    sessionStore.clear('logout');
  }

  return { remoteLogout };
}
