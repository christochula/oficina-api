import { PrismaClienteRepository } from './prisma-cliente.repository';

describe('PrismaClienteRepository.listar', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const prisma = { cliente: { findMany, count } };

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
  });

  it('aplica a mesma busca normalizada à consulta e à contagem', async () => {
    const repository = new PrismaClienteRepository(prisma as any);

    await repository.listar(2, 10, {
      busca: ' A1B2.C3D4/E5F6-01 ',
      ativo: true,
    });

    const consulta = findMany.mock.calls[0][0];
    const contagem = count.mock.calls[0][0];
    expect(consulta).toMatchObject({
      skip: 10,
      take: 10,
      orderBy: { nome: 'asc' },
      where: {
        ativo: true,
        OR: expect.arrayContaining([
          { nome: { contains: 'A1B2.C3D4/E5F6-01', mode: 'insensitive' } },
          { email: { contains: 'A1B2.C3D4/E5F6-01', mode: 'insensitive' } },
          {
            numeroDoc: {
              contains: 'A1B2C3D4E5F601',
              mode: 'insensitive',
            },
          },
          { telefone: { contains: '12345601' } },
        ]),
      },
    });
    expect(contagem.where).toBe(consulta.where);
  });

  it('normaliza telefone e preserva o filtro de inativos', async () => {
    const repository = new PrismaClienteRepository(prisma as any);

    await repository.listar(1, 20, {
      busca: '(11) 98765-4321',
      ativo: false,
    });

    const where = findMany.mock.calls[0][0].where;
    expect(where.ativo).toBe(false);
    expect(where.OR).toContainEqual({
      telefone: { contains: '11987654321' },
    });
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('não cria alternativas de busca para termo vazio', async () => {
    const repository = new PrismaClienteRepository(prisma as any);

    await repository.listar(1, 20, { busca: '   ' });

    const where = findMany.mock.calls[0][0].where;
    expect(where).toEqual({});
    expect(count).toHaveBeenCalledWith({ where });
  });
});
