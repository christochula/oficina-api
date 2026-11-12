const PREFIX = 'oficina.draft.v1:';
const MAX_AGE = 24 * 60 * 60 * 1000;

function scopeKey(scope) {
  if (!scope?.subject || !scope?.role) return null;
  return `${PREFIX}${encodeURIComponent(scope.role)}:${encodeURIComponent(scope.subject)}:`;
}

export function readDraft(scope, name, storage = globalThis.sessionStorage) {
  const prefix = scopeKey(scope);
  if (!prefix) return null;
  try {
    const key = prefix + encodeURIComponent(name);
    const saved = JSON.parse(storage?.getItem(key) ?? 'null');
    if (saved?.version !== 1 || !Number.isFinite(saved.updatedAt) || Date.now() - saved.updatedAt > MAX_AGE) {
      storage?.removeItem(key);
      return null;
    }
    return saved.value;
  } catch { return null; }
}

export function saveDraft(scope, name, value, storage = globalThis.sessionStorage) {
  const prefix = scopeKey(scope);
  if (!prefix) return false;
  try {
    storage?.setItem(prefix + encodeURIComponent(name), JSON.stringify({ version: 1, updatedAt: Date.now(), value }));
    return Boolean(storage);
  } catch { return false; }
}

export function clearDraft(scope, name, storage = globalThis.sessionStorage) {
  const prefix = scopeKey(scope);
  if (!prefix) return;
  try { storage?.removeItem(prefix + encodeURIComponent(name)); } catch { /* In-memory editing remains available. */ }
}

export function clearDraftScope(scope, storage = globalThis.sessionStorage) {
  const prefix = scopeKey(scope);
  if (!prefix) return;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      const resourcePrefix = `oficina.resource-context.v1:${scope.role}:${scope.subject}:`;
      const orderListPrefix = `oficina.order-list-context.v1:${scope.role}:${scope.subject}`;
      if (key?.startsWith(prefix) || key?.startsWith(resourcePrefix) || key === orderListPrefix) storage.removeItem(key);
    }
  } catch { /* Logout must remain available. */ }
}

export function captureForm(form) {
  const values = {};
  for (const field of form.elements) {
    if (!field.name || ['password', 'submit', 'button', 'file'].includes(field.type)) continue;
    if (['radio', 'checkbox'].includes(field.type) && !field.checked) continue;
    values[field.name] = field.value;
  }
  return values;
}

export function restoreForm(form, values = {}) {
  for (const field of form.elements) {
    if (!field.name || !(field.name in values)) continue;
    if (['radio', 'checkbox'].includes(field.type)) field.checked = field.value === values[field.name];
    else field.value = values[field.name];
  }
}
