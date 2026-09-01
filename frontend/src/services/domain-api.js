import { apiClient } from '../api/client.js';

function withQuery(path, query = {}) {
  const entries = Object.entries(query).flatMap(([key, value]) => {
    if (value === undefined || value === null || value === '') return [];
    if (Array.isArray(value)) return value.map((item) => [key, item]);
    return [[key, value]];
  });
  if (!entries.length) return path;
  const search = new URLSearchParams(entries.map(([key, value]) => [key, String(value)]));
  return `${path}${path.includes('?') ? '&' : '?'}${search}`;
}

export const domainApi = {
  request(path, { method = 'GET', body, query, headers, signal } = {}) {
    return apiClient.request(withQuery(path, query), {
      method,
      body,
      headers,
      signal,
    });
  },
  get(path, options = {}) {
    return this.request(path, { ...options, method: 'GET' });
  },
  post(path, body, options = {}) {
    return this.request(path, { ...options, method: 'POST', body });
  },
  patch(path, body, options = {}) {
    return this.request(path, { ...options, method: 'PATCH', body });
  },
  delete(path, options = {}) {
    return this.request(path, { ...options, method: 'DELETE' });
  },
  correlationId() {
    return apiClient.getLastCorrelationId?.() ?? '';
  },
};

export function extractPage(payload) {
  if (Array.isArray(payload)) {
    return { data: payload, meta: { pagina: 1, porPagina: payload.length, total: payload.length, totalPaginas: 1 } };
  }
  if (payload && Array.isArray(payload.data)) return payload;
  return { data: [], meta: { pagina: 1, porPagina: 20, total: 0, totalPaginas: 1 } };
}

export function apiErrorMessage(error, fallback = 'Não foi possível concluir a operação.') {
  const message = error?.message ?? error?.mensagem;
  if (Array.isArray(message)) return message.join(' ');
  return message || fallback;
}
