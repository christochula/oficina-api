import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListarMecanicosQueryDto } from './listar-mecanicos-query.dto';

describe('ListarMecanicosQueryDto', () => {
  it('transforma paginação, remove espaços da busca e converte ativo', async () => {
    const dto = plainToInstance(ListarMecanicosQueryDto, {
      pagina: '2',
      porPagina: '10',
      busca: '  Carlos Lima  ',
      ativo: 'true',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      pagina: 2,
      porPagina: 10,
      busca: 'Carlos Lima',
      ativo: true,
    });
  });

  it('rejeita busca com mais de 120 caracteres', async () => {
    const dto = plainToInstance(ListarMecanicosQueryDto, {
      busca: 'a'.repeat(121),
    });

    const erros = await validate(dto);
    expect(erros.some((erro) => erro.property === 'busca')).toBe(true);
  });

  it('rejeita valor booleano inválido', async () => {
    const dto = plainToInstance(ListarMecanicosQueryDto, { ativo: 'sim' });

    const erros = await validate(dto);
    expect(erros.some((erro) => erro.property === 'ativo')).toBe(true);
  });
});
