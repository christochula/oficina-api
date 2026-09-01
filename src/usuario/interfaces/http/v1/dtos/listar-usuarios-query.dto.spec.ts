import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PapelUsuario } from '../../../../domain/papel-usuario.enum';
import { ListarUsuariosQueryDto } from './listar-usuarios-query.dto';

describe('ListarUsuariosQueryDto', () => {
  it('transforma paginação, busca e filtro ativo', async () => {
    const dto = plainToInstance(ListarUsuariosQueryDto, {
      pagina: '2',
      porPagina: '15',
      busca: '  Carlos  ',
      papel: PapelUsuario.MECANICO,
      ativo: 'false',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      pagina: 2,
      porPagina: 15,
      busca: 'Carlos',
      papel: PapelUsuario.MECANICO,
      ativo: false,
    });
  });

  it('rejeita o papel CLIENTE', async () => {
    const dto = plainToInstance(ListarUsuariosQueryDto, {
      papel: PapelUsuario.CLIENTE,
    });
    const erros = await validate(dto);
    expect(erros.some((erro) => erro.property === 'papel')).toBe(true);
  });

  it('rejeita busca longa e booleano inválido', async () => {
    const dto = plainToInstance(ListarUsuariosQueryDto, {
      busca: 'a'.repeat(121),
      ativo: 'sim',
    });
    const erros = await validate(dto);
    expect(erros.map((erro) => erro.property)).toEqual(
      expect.arrayContaining(['busca', 'ativo']),
    );
  });
});
