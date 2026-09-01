import { RelatorioLeadTimeUseCase } from './relatorio-lead-time.usecase';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

const mockOsRepo = {
  buscarEntregues: jest.fn(),
  buscarPorId: jest.fn(),
  salvar: jest.fn(),
};

function criarUseCase() {
  return new RelatorioLeadTimeUseCase(mockOsRepo as any);
}

function criarOsEntregue(criadoEm: Date, entregueEm: Date): OrdemServico {
  const os = OrdemServico.reconstituir({
    id: OrdemServicoId.novo(),
    numero: 1,
    clienteId: 'cl_01',
    veiculoId: 've_01',
    status: StatusOrdemServico.ENTREGUE,
    criadoEm,
    atualizadoEm: entregueEm,
    historico: [
      {
        evento: 'VEICULO_ENTREGUE',
        descricao: 'FINALIZADA → ENTREGUE',
        criadoEm: entregueEm,
      },
    ],
  });
  return os;
}

describe('RelatorioLeadTimeUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve retornar zeros quando não há OS entregues', async () => {
    mockOsRepo.buscarEntregues.mockResolvedValue([]);

    const uc = criarUseCase();
    const resultado = await uc.executar();

    expect(resultado.totalOSEntregues).toBe(0);
    expect(resultado.leadTimeMedioHoras).toBe(0);
    expect(resultado.leadTimeMinimoHoras).toBe(0);
    expect(resultado.leadTimeMaximoHoras).toBe(0);
    expect(resultado.ordens).toHaveLength(0);
  });

  it('deve calcular leadTimeHoras corretamente para uma OS', async () => {
    const criadoEm = new Date('2026-01-01T08:00:00Z');
    const entregueEm = new Date('2026-01-01T10:00:00Z'); // 2 horas depois
    const os = criarOsEntregue(criadoEm, entregueEm);
    mockOsRepo.buscarEntregues.mockResolvedValue([os]);

    const uc = criarUseCase();
    const resultado = await uc.executar();

    expect(resultado.totalOSEntregues).toBe(1);
    expect(resultado.ordens[0].leadTimeHoras).toBe(2);
  });

  it('deve calcular média, mínimo e máximo corretamente', async () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const os1 = criarOsEntregue(
      base,
      new Date(base.getTime() + 4 * 3600 * 1000),
    ); // 4h
    const os2 = criarOsEntregue(
      base,
      new Date(base.getTime() + 8 * 3600 * 1000),
    ); // 8h
    const os3 = criarOsEntregue(
      base,
      new Date(base.getTime() + 12 * 3600 * 1000),
    ); // 12h

    mockOsRepo.buscarEntregues.mockResolvedValue([os1, os2, os3]);

    const uc = criarUseCase();
    const resultado = await uc.executar();

    expect(resultado.totalOSEntregues).toBe(3);
    expect(resultado.leadTimeMedioHoras).toBe(8); // (4+8+12)/3
    expect(resultado.leadTimeMinimoHoras).toBe(4);
    expect(resultado.leadTimeMaximoHoras).toBe(12);
  });

  it('deve usar atualizadoEm como fallback quando não há evento VEICULO_ENTREGUE', async () => {
    const criadoEm = new Date('2026-01-01T06:00:00Z');
    const atualizadoEm = new Date('2026-01-01T09:00:00Z'); // 3 horas depois

    const os = OrdemServico.reconstituir({
      id: OrdemServicoId.novo(),
      numero: 2,
      clienteId: 'cl_01',
      veiculoId: 've_01',
      status: StatusOrdemServico.ENTREGUE,
      criadoEm,
      atualizadoEm,
      historico: [], // sem evento VEICULO_ENTREGUE
    });
    mockOsRepo.buscarEntregues.mockResolvedValue([os]);

    const uc = criarUseCase();
    const resultado = await uc.executar();

    expect(resultado.ordens[0].leadTimeHoras).toBe(3);
  });

  it('deve retornar lista de ordens com detalhamento correto', async () => {
    const criadoEm = new Date('2026-01-01T08:00:00Z');
    const entregueEm = new Date('2026-01-01T16:00:00Z');
    const os = OrdemServico.reconstituir({
      id: OrdemServicoId.novo(),
      numero: 42,
      clienteId: 'cl_01',
      veiculoId: 've_01',
      status: StatusOrdemServico.ENTREGUE,
      criadoEm,
      atualizadoEm: entregueEm,
      historico: [{ evento: 'VEICULO_ENTREGUE', criadoEm: entregueEm }],
    });
    mockOsRepo.buscarEntregues.mockResolvedValue([os]);

    const uc = criarUseCase();
    const resultado = await uc.executar();

    expect(resultado.ordens[0].osId).toBe(os.id.valor);
    expect(resultado.ordens[0].criadoEm).toBe(criadoEm);
    expect(resultado.ordens[0].entregueEm).toBe(entregueEm);
  });
});
