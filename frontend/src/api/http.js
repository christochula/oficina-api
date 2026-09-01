import { joinUrl } from '../core/config.js';
import { SESSION_KIND } from '../core/session.js';
import { ApiError } from './errors.js';

function appendQuery(parameters, key, value) {
  if (value === null || value === undefined || value === '') return;
  if (Array.isArray(value)) {
    value.forEach((item) => appendQuery(parameters, key, item));
    return;
  }
  parameters.append(key, String(value));
}

export function buildRequestUrl(baseUrl, path, query) {
  const joined = joinUrl(baseUrl, path);
  if (!query) return joined;

  const [pathname, existingQuery = ''] = joined.split('?');
  const parameters = new URLSearchParams(existingQuery);
  if (query instanceof URLSearchParams) {
    query.forEach((value, key) => parameters.append(key, value));
  } else {
    Object.entries(query).forEach(([key, value]) =>
      appendQuery(parameters, key, value),
    );
  }
  const serialized = parameters.toString();
  return `${pathname}${serialized ? `?${serialized}` : ''}`;
}

export function unwrapEnvelope(body) {
  if (
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    Object.hasOwn(body, 'data')
  ) {
    if (Object.hasOwn(body, 'meta')) {
      return { data: body.data, meta: body.meta };
    }
    return body.data;
  }
  return body;
}

function createCorrelationId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isPassThroughBody(body) {
  return (
    typeof body === 'string' ||
    (typeof FormData !== 'undefined' && body instanceof FormData) ||
    (typeof Blob !== 'undefined' && body instanceof Blob) ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  );
}

function prepareBody(body, headers) {
  if (body === undefined || body === null) return undefined;
  if (isPassThroughBody(body)) return body;
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }
  return JSON.stringify(body);
}

async function parseResponseBody(response) {
  if (response.status === 204 || response.status === 205) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  const contentType = response.headers?.get?.('content-type') ?? '';
  if (contentType.includes('json')) {
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError('A API retornou uma resposta JSON inválida.', {
        status: response.status,
        code: 'INVALID_JSON_RESPONSE',
        retryable: response.status >= 500,
      });
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function abortContext(externalSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromExternal = () => controller.abort(externalSignal.reason);

  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener('abort', abortFromExternal, {
    once: true,
  });

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    cleanup() {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortFromExternal);
    },
  };
}

export function createHttpClient({
  baseUrl = '',
  fetchImpl = globalThis.fetch?.bind(globalThis),
  getSession = () => null,
  refreshSession,
  clearSession,
  timeoutMs = 15_000,
  onUnauthorized,
  onResponse,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('Uma implementação de fetch é obrigatória.');
  }

  let refreshPromise = null;
  let lastCorrelationId = null;

  async function refreshOnce(session) {
    if (!refreshPromise) {
      refreshPromise = Promise.resolve(refreshSession(session)).finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  async function execute(path, options, retried = false, tokenOverride = null) {
    const {
      method = 'GET',
      query,
      body,
      headers: customHeaders,
      signal: externalSignal,
      auth = true,
      token,
      unwrap = true,
      raw = false,
      retryOnUnauthorized = true,
      correlationId = createCorrelationId(),
      timeout = timeoutMs,
    } = options;

    const session = getSession?.() ?? null;
    const requestToken = tokenOverride ?? token ?? (auth ? session?.accessToken : null);
    const headers = new Headers(customHeaders);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    if (!headers.has('X-Correlation-Id')) {
      headers.set('X-Correlation-Id', correlationId);
    }
    if (requestToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${requestToken}`);
    }

    const requestBody = prepareBody(body, headers);
    const abort = abortContext(externalSignal, timeout);
    let response;
    try {
      response = await fetchImpl(buildRequestUrl(baseUrl, path, query), {
        method: method.toUpperCase(),
        headers,
        body: requestBody,
        signal: abort.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new ApiError(
          abort.didTimeOut()
            ? 'A solicitação demorou mais que o esperado.'
            : 'A solicitação foi cancelada.',
          {
            code: abort.didTimeOut() ? 'REQUEST_TIMEOUT' : 'REQUEST_ABORTED',
            correlationId,
            retryable: abort.didTimeOut(),
            cause: error,
          },
        );
      }
      throw new ApiError('Não foi possível conectar ao serviço.', {
        code: 'NETWORK_ERROR',
        correlationId,
        retryable: true,
        cause: error,
      });
    } finally {
      abort.cleanup();
    }

    const responseBody = await parseResponseBody(response);
    const responseCorrelationId =
      response.headers?.get?.('x-correlation-id') ??
      responseBody?.correlationId ??
      correlationId;
    lastCorrelationId = responseCorrelationId;

    if (typeof onResponse === 'function') {
      onResponse({ response, correlationId: responseCorrelationId });
    }

    if (
      response.status === 401 &&
      auth &&
      retryOnUnauthorized &&
      !retried
    ) {
      const latestSession = getSession?.() ?? session;

      if (
        latestSession?.accessToken &&
        latestSession.accessToken !== requestToken
      ) {
        return execute(
          path,
          { ...options, correlationId },
          true,
          latestSession.accessToken,
        );
      }

      if (
        latestSession?.kind === SESSION_KIND.OPERATOR &&
        latestSession.refreshToken &&
        typeof refreshSession === 'function'
      ) {
        try {
          const refreshedSession = await refreshOnce(latestSession);
          if (refreshedSession?.accessToken) {
            return execute(
              path,
              { ...options, correlationId },
              true,
              refreshedSession.accessToken,
            );
          }
        } catch {
          // A falha de refresh é convertida abaixo em uma expiração uniforme.
        }
      }

      clearSession?.('expired');
      const sessionError = new ApiError(
        'Sua sessão expirou. Entre novamente para continuar.',
        {
          status: 401,
          code: 'SESSION_EXPIRED',
          correlationId: responseCorrelationId,
        },
      );
      onUnauthorized?.(sessionError);
      throw sessionError;
    }

    if (!response.ok) {
      throw ApiError.fromResponse(
        response,
        responseBody,
        responseCorrelationId,
      );
    }

    const data = unwrap ? unwrapEnvelope(responseBody) : responseBody;
    if (raw) return { data, response, correlationId: responseCorrelationId };
    return data;
  }

  function request(path, options = {}) {
    return execute(path, options);
  }

  return Object.freeze({
    request,
    get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options = {}) =>
      request(path, { ...options, method: 'POST', body }),
    put: (path, body, options = {}) =>
      request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options = {}) =>
      request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options = {}) =>
      request(path, { ...options, method: 'DELETE' }),
    getLastCorrelationId: () => lastCorrelationId,
  });
}

export { ApiError } from './errors.js';
