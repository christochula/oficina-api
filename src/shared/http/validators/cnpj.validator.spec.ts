import { validate } from 'class-validator';
import { isValidCNPJ } from '../../utils/documento-validator';
import { IsValidCnpj } from './cnpj.validator';

describe('CnpjValido - validação direta do utilitário interno', () => {
  it('deve considerar CNPJ válido (somente dígitos)', () => {
    expect(isValidCNPJ('11222333000181')).toBe(true);
  });

  it('deve considerar CNPJ válido com formatação', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
  });

  it('deve considerar CNPJ inválido (todos zeros)', () => {
    expect(isValidCNPJ('00000000000000')).toBe(false);
  });

  it('deve considerar CNPJ inválido (dígitos repetidos)', () => {
    expect(isValidCNPJ('11111111111111')).toBe(false);
  });

  it('deve considerar CNPJ inválido (número qualquer)', () => {
    expect(isValidCNPJ('12345678000100')).toBe(false);
  });
});

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
