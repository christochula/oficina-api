import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PapelUsuario } from '../../../../domain/papel-usuario.enum';
import { CriarUsuarioDto } from './criar-usuario.dto';

describe('CriarUsuarioDto', () => {
  it('aceita senha entre 6 e 72 caracteres', async () => {
    const dto = plainToInstance(CriarUsuarioDto, {
      nome: 'Carlos',
      email: 'carlos@oficina.com.br',
      senha: 'a'.repeat(72),
      papel: PapelUsuario.MECANICO,
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('normaliza nome e e-mail', async () => {
    const dto = plainToInstance(CriarUsuarioDto, {
      nome: '  Carlos Lima  ',
      email: '  CARLOS@OFICINA.COM.BR ',
      senha: 'senha123',
      papel: PapelUsuario.MECANICO,
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.nome).toBe('Carlos Lima');
    expect(dto.email).toBe('carlos@oficina.com.br');
  });

  it('rejeita nome formado somente por espaços', async () => {
    const dto = plainToInstance(CriarUsuarioDto, {
      nome: '     ',
      email: 'carlos@oficina.com.br',
      senha: 'senha123',
      papel: PapelUsuario.MECANICO,
    });
    const erros = await validate(dto);
    expect(dto.nome).toBe('');
    expect(erros.some((erro) => erro.property === 'nome')).toBe(true);
  });

  it('rejeita senha maior que 72 caracteres', async () => {
    const dto = plainToInstance(CriarUsuarioDto, {
      nome: 'Carlos',
      email: 'carlos@oficina.com.br',
      senha: 'a'.repeat(73),
      papel: PapelUsuario.MECANICO,
    });
    const erros = await validate(dto);
    expect(erros.some((erro) => erro.property === 'senha')).toBe(true);
  });

  it('rejeita senha Unicode com mais de 72 bytes', async () => {
    const dto = plainToInstance(CriarUsuarioDto, {
      nome: 'Carlos',
      email: 'carlos@oficina.com.br',
      senha: 'á'.repeat(37),
      papel: PapelUsuario.MECANICO,
    });
    const erros = await validate(dto);
    expect(erros.some((erro) => erro.property === 'senha')).toBe(true);
  });
});
