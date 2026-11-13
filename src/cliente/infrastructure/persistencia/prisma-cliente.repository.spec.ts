import { PrismaClienteRepository } from './prisma-cliente.repository';
import { Cliente, TipoDocumento } from '../../domain/cliente.entity';

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

describe('PrismaClienteRepository identity and address mapping', () => {
  const model = {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const repository = new PrismaClienteRepository({ cliente: model } as never);
  const cliente = Cliente.criar({
    tipoDoc: TipoDocumento.CPF,
    numeroDoc: '11144477735',
    nome: 'Cliente teste',
    email: 'cliente@example.com',
    telefone: '11999999999',
    usuarioId: 'us_test',
    endereco: {
      logradouro: 'Rua A',
      numero: '10',
      complemento: 'Sala 2',
      bairro: 'Centro',
      cidade: 'Sao Paulo',
      estado: 'SP',
      cep: '01310100',
    },
  });
  const record = {
    ...cliente,
    id: cliente.id.valor,
    criadoEm: new Date('2026-01-01'),
    atualizadoEm: new Date('2026-01-02'),
  };

  beforeEach(() => jest.resetAllMocks());

  it('keeps fiscal identity immutable in upsert and saves all address fields', async () => {
    await repository.salvar(cliente);
    const saved = model.upsert.mock.calls[0][0];
    expect(saved.create).toMatchObject({
      numeroDoc: '11144477735',
      tipoDoc: 'CPF',
      usuarioId: 'us_test',
      complemento: 'Sala 2',
      bairro: 'Centro',
      cep: '01310100',
    });
    expect(saved.update).not.toHaveProperty('numeroDoc');
    expect(saved.update).not.toHaveProperty('tipoDoc');
    expect(saved.update).not.toHaveProperty('criadoEm');
    expect(saved.update).toMatchObject({ cidade: 'Sao Paulo', ativo: true });
  });

  it('maps lookups by ID, linked user and fiscal document', async () => {
    model.findUnique.mockResolvedValue(record);
    for (const result of [
      await repository.buscarPorId(cliente.id),
      await repository.buscarPorUsuarioId('us_test'),
      await repository.buscarPorNumeroDoc('11144477735'),
    ]) {
      expect(result).toBeInstanceOf(Cliente);
      expect(result).toMatchObject({
        id: cliente.id,
        usuarioId: 'us_test',
        logradouro: 'Rua A',
        complemento: 'Sala 2',
        criadoEm: record.criadoEm,
      });
    }
    expect(model.findUnique).toHaveBeenCalledWith({
      where: { usuarioId: 'us_test' },
    });
    expect(model.findUnique).toHaveBeenCalledWith({
      where: { numeroDoc: '11144477735' },
    });
    model.findUnique.mockResolvedValue(null);
    expect(await repository.buscarPorId(cliente.id)).toBeNull();
    expect(await repository.buscarPorUsuarioId('absent')).toBeNull();
    expect(await repository.buscarPorNumeroDoc('absent')).toBeNull();
  });

  it('preserves nullable addresses on inactive records and unfiltered pages', async () => {
    model.findMany.mockResolvedValue([
      {
        ...record,
        usuarioId: null,
        ativo: false,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        estado: null,
        cep: null,
      },
    ]);
    model.count.mockResolvedValue(1);
    const result = await repository.listar(1, 10);
    expect(result.itens[0]).toMatchObject({
      ativo: false,
      usuarioId: null,
      logradouro: null,
      complemento: null,
      cep: null,
    });
    expect(model.count).toHaveBeenCalledWith({ where: {} });
  });

  it('ignores punctuation-only search without generating empty document predicates', async () => {
    model.findMany.mockResolvedValue([]);
    model.count.mockResolvedValue(0);
    await repository.listar(1, 10, { busca: '...---' });
    const where = model.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { nome: { contains: '...---', mode: 'insensitive' } },
      { email: { contains: '...---', mode: 'insensitive' } },
    ]);
  });
});
