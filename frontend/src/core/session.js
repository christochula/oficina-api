import { decodeJwtPayload, getJwtExpiration } from './jwt.js';
import { ROLES } from './permissions.js';

const SESSION_STORAGE_KEY = 'oficina.session.v1';
const SESSION_VERSION = 1;

export const SESSION_KIND = Object.freeze({
  OPERATOR: 'operator',
  CLIENT: 'client',
});

function requireToken(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} ausente na resposta de autenticação.`);
  }
  return value;
}

function identityFromToken(token) {
  const payload = decodeJwtPayload(token) ?? {};
  return {
    role: payload.role ?? payload.papel ?? null,
    subject: payload.sub ?? null,
    email: payload.email ?? null,
    clientId: payload.client_id ?? payload.clienteId ?? null,
  };
}

function cloneSession(session) {
  return session ? { ...session } : null;
}

function isStoredSession(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.version !== SESSION_VERSION) return false;
  if (!Object.values(SESSION_KIND).includes(value.kind)) return false;
  if (typeof value.accessToken !== 'string' || !value.accessToken) return false;
  if (value.kind === SESSION_KIND.OPERATOR) {
    return typeof value.refreshToken === 'string' && Boolean(value.refreshToken);
  }
  return value.refreshToken === null && value.role === ROLES.CLIENT;
}

function resolveDefaultStorage() {
  try {
    if (globalThis.sessionStorage) return globalThis.sessionStorage;
  } catch {
    // Browsers can deny storage in privacy-restricted contexts.
  }
  return createMemoryStorage();
}

export function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

export function createOperatorSession(tokens, nowMs = Date.now()) {
  const accessToken = requireToken(tokens?.accessToken, 'accessToken');
  const refreshToken = requireToken(tokens?.refreshToken, 'refreshToken');
  const identity = identityFromToken(accessToken);

  if (identity.role === ROLES.CLIENT) {
    throw new TypeError('Um token de cliente não pode iniciar sessão de equipe.');
  }

  return Object.freeze({
    version: SESSION_VERSION,
    kind: SESSION_KIND.OPERATOR,
    accessToken,
    refreshToken,
    role: identity.role,
    subject: identity.subject,
    email: identity.email,
    clientId: null,
    accessExpiresAt: getJwtExpiration(accessToken),
    refreshExpiresAt: getJwtExpiration(refreshToken),
    createdAt: nowMs,
  });
}

export function createClientSession(tokenResponse, nowMs = Date.now()) {
  const accessToken = requireToken(
    tokenResponse?.access_token,
    'access_token',
  );
  const identity = identityFromToken(accessToken);
  const expiresIn = Number(tokenResponse?.expires_in);
  const fallbackExpiration = Number.isFinite(expiresIn)
    ? nowMs + Math.max(0, expiresIn) * 1_000
    : null;

  return Object.freeze({
    version: SESSION_VERSION,
    kind: SESSION_KIND.CLIENT,
    accessToken,
    refreshToken: null,
    role: ROLES.CLIENT,
    subject: identity.subject,
    email: null,
    clientId: identity.clientId ?? identity.subject,
    accessExpiresAt: getJwtExpiration(accessToken) ?? fallbackExpiration,
    refreshExpiresAt: null,
    createdAt: nowMs,
  });
}

export function canRefreshOperatorSession(session, nowMs = Date.now()) {
  if (session?.kind !== SESSION_KIND.OPERATOR || !session.refreshToken) {
    return false;
  }
  return session.refreshExpiresAt === null || session.refreshExpiresAt > nowMs;
}

export function isSessionExpired(session, nowMs = Date.now()) {
  if (!session) return true;
  if (session.kind === SESSION_KIND.OPERATOR) {
    return !canRefreshOperatorSession(session, nowMs);
  }
  return session.accessExpiresAt === null || session.accessExpiresAt <= nowMs;
}

export function createSessionStore({ storage = resolveDefaultStorage() } = {}) {
  const subscribers = new Set();

  function emit(type, session, reason = null) {
    const event = Object.freeze({ type, session: cloneSession(session), reason });
    subscribers.forEach((subscriber) => subscriber(event));
  }

  function persist(session, type) {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    emit(type, session);
    return cloneSession(session);
  }

  function get() {
    const serialized = storage.getItem(SESSION_STORAGE_KEY);
    if (!serialized) return null;
    try {
      const session = JSON.parse(serialized);
      if (!isStoredSession(session)) throw new TypeError('Sessão inválida.');
      if (isSessionExpired(session)) {
        storage.removeItem(SESSION_STORAGE_KEY);
        emit('cleared', null, 'expired');
        return null;
      }
      return cloneSession(session);
    } catch {
      storage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  }

  function setOperator(tokens) {
    return persist(createOperatorSession(tokens), 'authenticated');
  }

  function setClient(tokenResponse) {
    return persist(createClientSession(tokenResponse), 'authenticated');
  }

  function updateOperatorTokens(tokens) {
    const previous = get();
    if (previous?.kind !== SESSION_KIND.OPERATOR) {
      throw new TypeError('Não há sessão de equipe para renovar.');
    }
    const refreshed = {
      ...createOperatorSession(tokens),
      createdAt: previous.createdAt,
    };
    return persist(refreshed, 'refreshed');
  }

  function clear(reason = 'manual') {
    const previous = get();
    storage.removeItem(SESSION_STORAGE_KEY);
    emit('cleared', null, reason);
    return previous;
  }

  function subscribe(subscriber) {
    if (typeof subscriber !== 'function') {
      throw new TypeError('O assinante da sessão deve ser uma função.');
    }
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  return Object.freeze({
    get,
    setOperator,
    setClient,
    updateOperatorTokens,
    clear,
    subscribe,
    getAccessToken: () => get()?.accessToken ?? null,
    getRole: () => get()?.role ?? null,
  });
}

export const sessionStore = createSessionStore();
