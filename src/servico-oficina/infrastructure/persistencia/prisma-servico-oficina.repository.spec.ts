import { PrismaServicoOficinaRepository } from './prisma-servico-oficina.repository';
import { ServicoOficina } from '../../domain/servico-oficina.entity';

describe('PrismaServicoOficinaRepository persistence contract', () => {
  const model = {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const repository = new PrismaServicoOficinaRepository({
    servicoOficina: model,
  } as never);
  const servico = ServicoOficina.criar({
    nome: 'Alinhamento',
    descricao: 'Alinhamento dos eixos',
    categoria: 'Preventiva',
  });
  const record = {
    ...servico,
    id: servico.id.valor,
    criadoEm: new Date('2026-01-01'),
    atualizadoEm: new Date('2026-01-02'),
  };

  beforeEach(() => jest.resetAllMocks());

  it('persists nullable fields and activation without overwriting creation time', async () => {
    servico.atualizar({ descricao: null, categoria: null });
    servico.desativar();
    await repository.salvar(servico);
    const saved = model.upsert.mock.calls[0][0];
    expect(saved.create).toMatchObject({
      id: servico.id.valor,
      nome: 'Alinhamento',
      descricao: null,
      categoria: null,
      ativo: false,
    });
    expect(saved.update).not.toHaveProperty('criadoEm');
    expect(saved.update).toMatchObject({ descricao: null, ativo: false });
  });

  it('returns domain entities for existing services and null for absent ones', async () => {
    model.findUnique.mockResolvedValue(record);
    const result = await repository.buscarPorId(servico.id);
    expect(result).toBeInstanceOf(ServicoOficina);
    expect(result).toMatchObject({
      id: servico.id,
      nome: record.nome,
      descricao: record.descricao,
      criadoEm: record.criadoEm,
      atualizadoEm: record.atualizadoEm,
    });
    model.findUnique.mockResolvedValue(null);
    expect(await repository.buscarPorId(servico.id)).toBeNull();
  });

  it('filters inactive services from both catalog page and total', async () => {
    model.findMany.mockResolvedValue([{ ...record, descricao: null }]);
    model.count.mockResolvedValue(4);
    const result = await repository.listar(2, 2);
    expect(model.findMany).toHaveBeenCalledWith({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      skip: 2,
      take: 2,
    });
    expect(model.count).toHaveBeenCalledWith({ where: { ativo: true } });
    expect(result.total).toBe(4);
    expect(result.itens[0].descricao).toBeNull();
  });
});
