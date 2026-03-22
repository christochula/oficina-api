import { cpf } from 'cpf-cnpj-validator';
import { validate } from 'class-validator';
import { IsValidCpf } from './cpf.validator';

// Testa a lógica de validação de CPF usando a lib usada pelo validator
describe('CpfValido - validação direta da biblioteca', () => {
  it('deve considerar CPF válido (somente dígitos)', () => {
    expect(cpf.isValid('11144477735')).toBe(true);
  });

  it('deve considerar CPF válido com formatação', () => {
    expect(cpf.isValid('111.444.777-35')).toBe(true);
  });

  it('deve considerar CPF inválido (todos zeros)', () => {
    expect(cpf.isValid('000.000.000-00')).toBe(false);
  });

  it('deve considerar CPF inválido (dígitos repetidos)', () => {
    expect(cpf.isValid('111.111.111-11')).toBe(false);
  });

  it('deve considerar CPF inválido (número qualquer)', () => {
    expect(cpf.isValid('12345678900')).toBe(false);
  });
});

// Testa o decorator IsValidCpf integrado com class-validator
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
