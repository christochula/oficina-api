import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PapelUsuario } from '../../../../domain/papel-usuario.enum';
import { AtualizarUsuarioDto } from './atualizar-usuario.dto';

describe('AtualizarUsuarioDto', () => {
  it('aceita campos internos e normaliza nome e e-mail', async () => {
    const dto = plainToInstance(AtualizarUsuarioDto, {
      nome: '  Carlos Lima  ',
      email: '  CARLOS@OFICINA.COM.BR ',
      papel: PapelUsuario.MECANICO,
      senha: 'novaSenha123',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      nome: 'Carlos Lima',
      email: 'carlos@oficina.com.br',
      papel: PapelUsuario.MECANICO,
      senha: 'novaSenha123',
    });
  });

  it('rejeita papel CLIENTE', async () => {
    const dto = plainToInstance(AtualizarUsuarioDto, {
      papel: PapelUsuario.CLIENTE,
    });
    const erros = await validate(dto);
    expect(erros.some((erro) => erro.property === 'papel')).toBe(true);
  });

  it.each(['curta', 'a'.repeat(73)])(
    'rejeita senha fora do intervalo bcrypt: %s',
    async (senha) => {
      const dto = plainToInstance(AtualizarUsuarioDto, { senha });
      const erros = await validate(dto);
      expect(erros.some((erro) => erro.property === 'senha')).toBe(true);
    },
  );

  it('rejeita senha Unicode com mais de 72 bytes', async () => {
    const dto = plainToInstance(AtualizarUsuarioDto, {
      senha: 'á'.repeat(37),
    });
    const erros = await validate(dto);
    expect(erros.some((erro) => erro.property === 'senha')).toBe(true);
  });

  it('rejeita null nos campos opcionais quando enviados', async () => {
    const dto = plainToInstance(AtualizarUsuarioDto, { nome: null });
    const erros = await validate(dto);
    expect(erros.some((erro) => erro.property === 'nome')).toBe(true);
  });
});
