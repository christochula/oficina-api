import { cnpj } from 'cpf-cnpj-validator';
import { validate } from 'class-validator';
import { IsValidCnpj } from './cnpj.validator';

// Testa a lógica de validação de CNPJ usando a lib usada pelo validator
describe('CnpjValido - validação direta da biblioteca', () => {
  it('deve considerar CNPJ válido (somente dígitos)', () => {
    expect(cnpj.isValid('11222333000181')).toBe(true);
  });

  it('deve considerar CNPJ válido com formatação', () => {
    expect(cnpj.isValid('11.222.333/0001-81')).toBe(true);
  });

  it('deve considerar CNPJ inválido (todos zeros)', () => {
    expect(cnpj.isValid('00000000000000')).toBe(false);
  });

  it('deve considerar CNPJ inválido (dígitos repetidos)', () => {
    expect(cnpj.isValid('11111111111111')).toBe(false);
  });

  it('deve considerar CNPJ inválido (número qualquer)', () => {
    expect(cnpj.isValid('12345678000100')).toBe(false);
  });
});

// Testa o decorator IsValidCnpj integrado com class-validator
describe('IsValidCnpj - decorator', () => {
  class DtoTeste {
    @IsValidCnpj()
    cnpj: string;
  }

  it('deve aceitar CNPJ válido', async () => {
    const dto = new DtoTeste();
    dto.cnpj = '11222333000181';
    const erros = await validate(dto);
    expect(erros).toHaveLength(0);
  });

  it('deve rejeitar CNPJ inválido', async () => {
    const dto = new DtoTeste();
    dto.cnpj = '00000000000000';
    const erros = await validate(dto);
    expect(erros.length).toBeGreaterThan(0);
    expect(erros[0].constraints?.isValidCnpj).toBe('CNPJ inválido');
  });
});
