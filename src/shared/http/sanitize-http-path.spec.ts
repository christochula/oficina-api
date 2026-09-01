import { sanitizeHttpPath } from './sanitize-http-path';

describe('sanitizeHttpPath', () => {
  it.each([
    '/api/v1/ordens-servico/publico/status/42/52998224725',
    '/api/v1/ordens-servico/publico/status/42/529.982.247-25',
    '/api/v1/ordens-servico/publico/status/42/11.222.333/0001-81',
    '/api/v1/ordens-servico/publico/status/42/529_982_247_25',
    '/api/v1/ordens-servico/publico/status/42/A1B2.C3D4.E5F6/G7H8-01',
  ])('redacts CPF/CNPJ-like path segments from %s', (path) => {
    expect(sanitizeHttpPath(path)).toBe(
      '/api/v1/ordens-servico/publico/status/42/:documento',
    );
  });

  it('drops query strings and preserves ordinary route identifiers', () => {
    expect(
      sanitizeHttpPath('/api/v1/ordens-servico/os_123?cpf=52998224725'),
    ).toBe('/api/v1/ordens-servico/os_123');
  });

  it('redacts a document based on a sensitive route position', () => {
    expect(sanitizeHttpPath('/api/v1/clientes/documento/A1B2C3D4E5F6G7')).toBe(
      '/api/v1/clientes/documento/:documento',
    );
  });

  it('does not throw for malformed encoding', () => {
    expect(sanitizeHttpPath('/api/%E0%A4%A')).toBe('/api/%E0%A4%A');
  });
});
