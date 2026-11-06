import { PrismaVeiculoRepository } from './prisma-veiculo.repository';
import { Veiculo } from '../../domain/veiculo.entity';

describe('PrismaVeiculoRepository persistence contract', () => {
  const model = {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const repository = new PrismaVeiculoRepository({ veiculo: model } as never);
  const veiculo = Veiculo.criar({
    placa: 'BRA2E19',
    renavam: '12345678901',
    chassi: '9BWZZZ377VT004251',
    marca: 'Fiat',
    modelo: 'Demo',
    ano: 2020,
    cor: 'Prata',
    quilometragem: 12000,
  });
  const record = {
    ...veiculo,
    id: veiculo.id.valor,
    criadoEm: new Date('2026-01-01'),
    atualizadoEm: new Date('2026-01-02'),
  };

  beforeEach(() => jest.resetAllMocks());

  it('preserves registration identifiers while updating only mutable fields', async () => {
    await repository.salvar(veiculo);
    const saved = model.upsert.mock.calls[0][0];
    expect(saved.create).toMatchObject({
      id: veiculo.id.valor,
      placa: 'BRA2E19',
      renavam: '12345678901',
      chassi: '9BWZZZ377VT004251',
      quilometragem: 12000,
    });
    expect(saved.update).toEqual({
      cor: 'Prata',
      quilometragem: 12000,
      ativo: true,
      atualizadoEm: veiculo.atualizadoEm,
    });
  });

  it('maps reads by ID and plate into domain entities, including timestamps', async () => {
    model.findUnique.mockResolvedValue(record);
    const byId = await repository.buscarPorId(veiculo.id);
    const byPlate = await repository.buscarPorPlaca('BRA2E19');
    expect(byId).toBeInstanceOf(Veiculo);
    expect(byId).toMatchObject({
      id: veiculo.id,
      placa: 'BRA2E19',
      quilometragem: 12000,
      criadoEm: record.criadoEm,
      atualizadoEm: record.atualizadoEm,
    });
    expect(byPlate?.id.valor).toBe(veiculo.id.valor);
    expect(model.findUnique).toHaveBeenCalledWith({
      where: { placa: 'BRA2E19' },
    });
    model.findUnique.mockResolvedValue(null);
    expect(await repository.buscarPorId(veiculo.id)).toBeNull();
    expect(await repository.buscarPorPlaca('XXX0000')).toBeNull();
  });

  it('keeps paginated query, total and mapped inactive vehicles consistent', async () => {
    model.findMany.mockResolvedValue([{ ...record, ativo: false }]);
    model.count.mockResolvedValue(7);
    const result = await repository.listar(2, 3);
    expect(model.findMany).toHaveBeenCalledWith({
      orderBy: { placa: 'asc' },
      skip: 3,
      take: 3,
    });
    expect(result.total).toBe(7);
    expect(result.itens[0]).toBeInstanceOf(Veiculo);
    expect(result.itens[0].ativo).toBe(false);
  });

  it('propagates database failures instead of returning a successful save', async () => {
    model.upsert.mockRejectedValue(new Error('connection unavailable'));
    await expect(repository.salvar(veiculo)).rejects.toThrow('unavailable');
  });
});
