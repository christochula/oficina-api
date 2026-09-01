import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListarClientesQueryDto } from './listar-clientes-query.dto';

describe('ListarClientesQueryDto', () => {
  it('transforma paginação, remove espaços da busca e converte ativo', async () => {
    const dto = plainToInstance(ListarClientesQueryDto, {
      pagina: '2',
      porPagina: '15',
      busca: '  Maria Silva  ',
      ativo: 'false',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      pagina: 2,
      porPagina: 15,
      busca: 'Maria Silva',
      ativo: false,
    });
  });

  it('rejeita busca com mais de 120 caracteres', async () => {
    const dto = plainToInstance(ListarClientesQueryDto, {
      busca: 'a'.repeat(121),
    });

    const erros = await validate(dto);
    expect(erros.some((erro) => erro.property === 'busca')).toBe(true);
  });

  it('rejeita valor booleano inválido', async () => {
    const dto = plainToInstance(ListarClientesQueryDto, { ativo: 'sim' });

    const erros = await validate(dto);
    expect(erros.some((erro) => erro.property === 'ativo')).toBe(true);
  });
});
