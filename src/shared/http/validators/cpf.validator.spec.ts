import { validate } from 'class-validator';
import { isValidCPF } from '../../utils/documento-validator';
import { IsValidCpf } from './cpf.validator';

describe('CpfValido - validação direta do utilitário interno', () => {
  it('deve considerar CPF válido (somente dígitos)', () => {
    expect(isValidCPF('11144477735')).toBe(true);
  });

  it('deve considerar CPF válido com formatação', () => {
    expect(isValidCPF('111.444.777-35')).toBe(true);
  });

  it('deve considerar CPF inválido (todos zeros)', () => {
    expect(isValidCPF('000.000.000-00')).toBe(false);
  });

  it('deve considerar CPF inválido (dígitos repetidos)', () => {
    expect(isValidCPF('111.111.111-11')).toBe(false);
  });

  it('deve considerar CPF inválido (número qualquer)', () => {
    expect(isValidCPF('12345678900')).toBe(false);
  });
});

describe('IsValidCpf - decorator', () => {
  class DtoTeste {
    @IsValidCpf()
    cpf: string;
  }

  it('deve aceitar CPF válido', async () => {
    const dto = new DtoTeste();
    dto.cpf = '11144477735';
    const erros = await validate(dto);
    expect(erros).toHaveLength(0);
  });

  it('deve rejeitar CPF inválido', async () => {
    const dto = new DtoTeste();
    dto.cpf = '00000000000';
    const erros = await validate(dto);
    expect(erros.length).toBeGreaterThan(0);
    expect(erros[0].constraints?.isValidCpf).toBe('CPF inválido');
  });
});
