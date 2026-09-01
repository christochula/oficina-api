const DEFAULT_API_BASE_URL = '/api/v1';
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

function normalizeBaseUrl(value, fallback = '') {
  const normalized = String(value ?? fallback).trim();
  if (!normalized || normalized === '/') return '';
  return normalized.replace(/\/+$/, '');
}

function parseTimeout(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_REQUEST_TIMEOUT_MS;
  return Math.min(60_000, Math.max(1_000, Math.trunc(parsed)));
}

export function joinUrl(baseUrl, path) {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = String(path ?? '').trim();

  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;

  const pathWithSlash = normalizedPath.startsWith('/')
    ? normalizedPath
    : `/${normalizedPath}`;

  return `${normalizedBase}${pathWithSlash || '/'}` || '/';
}

export function createRuntimeConfig(environment = {}) {
  return Object.freeze({
    apiBaseUrl: normalizeBaseUrl(
      environment.VITE_API_BASE_URL,
      DEFAULT_API_BASE_URL,
    ),
    clientAuthBaseUrl: normalizeBaseUrl(
      environment.VITE_CLIENT_AUTH_BASE_URL,
      '',
    ),
    requestTimeoutMs: parseTimeout(environment.VITE_REQUEST_TIMEOUT_MS),
  });
}

export const runtimeConfig = createRuntimeConfig(import.meta.env ?? {});
