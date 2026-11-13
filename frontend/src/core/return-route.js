const KEY = 'oficina.return-route.v1';

export function safeReturnRoute(path) {
  // Store a route, never a full URL or provider query parameters.
  if (typeof path !== 'string' || path.length > 200) return null;
  if (/^\/(inicio|meu-trabalho|ordens|clientes|veiculos|estoque|catalogo|usuarios|relatorios)$/.test(path)) return path;
  return /^\/ordens\/[a-zA-Z0-9_-]+$/.test(path) ? path : null;
}

export function rememberReturnRoute(path, storage = globalThis.sessionStorage) {
  const safe = safeReturnRoute(path);
  if (!safe) return;
  try { storage?.setItem(KEY, safe); } catch { /* Storage may be unavailable. */ }
}

export function takeReturnRoute(fallback, storage = globalThis.sessionStorage) {
  try {
    const saved = safeReturnRoute(storage?.getItem(KEY));
    storage?.removeItem(KEY);
    return saved || fallback;
  } catch { return fallback; }
}

export function clearReturnRoute(storage = globalThis.sessionStorage) {
  try { storage?.removeItem(KEY); } catch { /* Logging out still succeeds. */ }
}
