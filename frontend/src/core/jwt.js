function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Decodifica claims somente para personalização da interface. A assinatura e a
 * autorização continuam sendo responsabilidade exclusiva do backend.
 */
export function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : null;
  } catch {
    return null;
  }
}

export function getJwtExpiration(token) {
  const expiration = decodeJwtPayload(token)?.exp;
  return Number.isFinite(expiration) ? expiration * 1_000 : null;
}

export function isTokenExpired(token, skewSeconds = 30, nowMs = Date.now()) {
  const expiresAt = getJwtExpiration(token);
  if (expiresAt === null) return true;
  return expiresAt <= nowMs + Math.max(0, skewSeconds) * 1_000;
}
