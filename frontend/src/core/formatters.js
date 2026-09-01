const PLACEHOLDER = '—';

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function formatCpf(value) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function formatCnpj(value) {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function formatDocument(value, type) {
  const digits = onlyDigits(value);
  if (type === 'CNPJ' || digits.length > 11) return formatCnpj(digits);
  return formatCpf(digits);
}

export function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return '';
  if (digits.length < 3) return `(${digits}`;

  const areaCode = digits.slice(0, 2);
  const local = digits.slice(2);
  const prefixLength = digits.length > 10 ? 5 : 4;
  const prefix = local.slice(0, prefixLength);
  const suffix = local.slice(prefixLength);
  return `(${areaCode}) ${prefix}${suffix ? `-${suffix}` : ''}`;
}

export function formatCep(value) {
  return onlyDigits(value)
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function formatLicensePlate(value) {
  const plate = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);
  return plate.length > 3 ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
}

export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return PLACEHOLDER;
  const number = Number(value);
  if (!Number.isFinite(number)) return PLACEHOLDER;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(number);
}

function coerceDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }
  return new Date(value);
}

function validDate(value) {
  const date = coerceDate(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, options = {}) {
  const date = validDate(value);
  if (!date) return PLACEHOLDER;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  }).format(date);
}

export function formatDateTime(value, options = {}) {
  const date = validDate(value);
  if (!date) return PLACEHOLDER;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  }).format(date);
}

export function formatMileage(value) {
  if (value === null || value === undefined || value === '') return PLACEHOLDER;
  const number = Number(value);
  if (!Number.isFinite(number)) return PLACEHOLDER;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(number)} km`;
}

export function formatDurationMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) return PLACEHOLDER;
  const wholeMinutes = Math.round(minutes);
  const hours = Math.floor(wholeMinutes / 60);
  const remainder = wholeMinutes % 60;
  if (!hours) return `${remainder}min`;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}

export function formatOrderNumber(value) {
  if (value === null || value === undefined || value === '') return PLACEHOLDER;
  const normalized = String(value).trim().replace(/^#/, '');
  return `#${normalized}`;
}
