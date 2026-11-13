/** PostgreSQL LIKE parameter, with literal wildcards and Portuguese diacritics normalized. */
export function catalogSearchPattern(value: string): string {
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  return `%${normalized.replace(/[\\%_]/g, '\\$&')}%`;
}
