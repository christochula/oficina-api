const prefix = 'oficina.pending-consumption.';
const memory = new Map();
function storage() { try { return globalThis.sessionStorage; } catch { return null; } }

export function pendingConsumption(osId) {
  try {
    const saved = JSON.parse(storage()?.getItem(prefix + osId) || 'null');
    if (saved && typeof saved.operationId === 'string' && typeof saved.pecaId === 'string' &&
        Number.isSafeInteger(saved.quantidade) && saved.quantidade > 0) memory.set(osId, saved);
  } catch { /* An unavailable storage must not erase the in-memory receipt. */ }
  return memory.get(osId) || null;
}

export function beginConsumption(osId, { pecaId, quantidade }) {
  const pending = pendingConsumption(osId);
  if (pending) {
    if (pending.pecaId !== pecaId || pending.quantidade !== quantidade) {
      throw new Error('Confirme primeiro o consumo pendente antes de registrar outra peça ou quantidade.');
    }
    return pending;
  }
  const attempt = { operationId: globalThis.crypto.randomUUID(), pecaId, quantidade };
  memory.set(osId, attempt);
  try { storage()?.setItem(prefix + osId, JSON.stringify(attempt)); } catch { /* Keep the receipt in memory. */ }
  return attempt;
}

export function finishConsumption(osId, operationId) {
  if (pendingConsumption(osId)?.operationId !== operationId) return;
  memory.delete(osId);
  try { storage()?.removeItem(prefix + osId); } catch { /* Storage may be unavailable. */ }
}
