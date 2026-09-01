const CNPJ_PATTERN = /(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g;
const CPF_PATTERN = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g;
const SENSITIVE_ROUTE_PATTERNS = [
  /(\/clientes\/documento\/).+$/i,
  /(\/ordens-servico\/publico\/status\/[^/]+\/).+$/i,
];

/**
 * Remove CPF/CNPJ-like path segments before they reach logs, traces or error
 * envelopes. Query strings are discarded because their keys are not part of
 * the operational route identity and may contain user-controlled data.
 */
export function sanitizeHttpPath(value: string): string {
  const path = decodeSafely(value.split('?', 1)[0] ?? '/');
  const routeRedacted = SENSITIVE_ROUTE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, '$1:documento'),
    path,
  );
  return routeRedacted
    .replace(CNPJ_PATTERN, ':documento')
    .replace(CPF_PATTERN, ':documento');
}

function decodeSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
