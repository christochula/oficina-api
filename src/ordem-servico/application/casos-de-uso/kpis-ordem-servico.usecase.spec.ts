import { KpisOrdemServicoUseCase } from './kpis-ordem-servico.usecase';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

// ── Helpers de teste ──────────────────────────────────────────────────────────

function criarDataOffset(base: Date, horas: number): Date {
  return new Date(base.getTime() + horas * 60 * 60 * 1000);
}

function criarOSComHistorico(
  eventos: { evento: string; horasDesdeBase: number }[],
  comOrcamento = false,
  orcamentoAprovado = false,
): OrdemServico {
  const base = new Date('2026-01-01T08:00:00Z');
  const historico = eventos.map(({ evento, horasDesdeBase }) => ({
    id: `hist-${evento}`,
    evento,
    criadoEm: criarDataOffset(base, horasDesdeBase),
  }));

  return OrdemServico.reconstituir({
    id: OrdemServicoId.de('os01testeKpiUseCase01'),
    numero: 1,
    status: StatusOrdemServico.ENTREGUE,
    clienteId: 'cl-cliente-001',
    veiculoId: 've-veiculo-001',
    mecanicoResponsavelId: 'us-mecanico-001',
    problemasRelatados: [{ descricao: 'Problema A' }],
    servicosSolicitados: [],
    diagnostico: null,
    orcamento: comOrcamento
      ? ({
          total: 500,
          aprovadoEm: orcamentoAprovado ? new Date() : null,
          rejeitadoEm: null,
          criadoEm: new Date(),
          grupos: [],
        } as any)
      : null,
    historico,
    consumosPeca: [],
    criadoEm: base,
    atualizadoEm: base,
  });
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('KpisOrdemServicoUseCase', () => {
  let useCase: KpisOrdemServicoUseCase;
  let repositorioMock: { buscarTodasComHistorico: jest.Mock };

  beforeEach(() => {
    repositorioMock = { buscarTodasComHistorico: jest.fn() };
    useCase = new KpisOrdemServicoUseCase(repositorioMock as any);
    Reflect.defineMetadata(ORDEM_SERVICO_REPOSITORY, repositorioMock, useCase);
  });

  describe('sem ordens de serviço', () => {
    it('deve retornar zeros em todos os KPIs', async () => {
      repositorioMock.buscarTodasComHistorico.mockResolvedValue([]);

      const resultado = await useCase.executar();

      expect(resultado.esperaAtribuicao.totalAmostras).toBe(0);
      expect(resultado.esperaAtribuicao.mediaHoras).toBe(0);
      expect(resultado.leadTimeTotal.totalAmostras).toBe(0);
      expect(resultado.taxaAprovacaoOrcamento).toBe(0);
    });
  });

  describe('com uma OS completa (todos os eventos)', () => {
    /**
     * Ciclo:
     * H+0   ORDEM_ABERTA
     * H+2   MECANICO_ATRIBUIDO     (2h espera atribuição)
     * H+5   ORCAMENTO_GERADO       (3h diagnóstico + orçamento)
     * H+9   ORCAMENTO_APROVADO     (4h aprovação cliente)
     * H+9   EXECUCAO_INICIADA      (0h entre aprovação e execução)
     * H+14  ORDEM_FINALIZADA       (5h execução)
     * H+16  VEICULO_ENTREGUE       (2h espera entrega)
     * Lead-time total: 16h
     * Tempo técnico líquido: 16 - 2 (atribuição) - 4 (cliente) - 2 (entrega) = 8h
     */
    it('deve calcular todos os segmentos corretamente', async () => {
      const os = criarOSComHistorico(
        [
          { evento: 'ORDEM_ABERTA', horasDesdeBase: 0 },
          { evento: 'MECANICO_ATRIBUIDO', horasDesdeBase: 2 },
          { evento: 'ORCAMENTO_GERADO', horasDesdeBase: 5 },
          { evento: 'ORCAMENTO_APROVADO', horasDesdeBase: 9 },
          { evento: 'EXECUCAO_INICIADA', horasDesdeBase: 9 },
          { evento: 'ORDEM_FINALIZADA', horasDesdeBase: 14 },
          { evento: 'VEICULO_ENTREGUE', horasDesdeBase: 16 },
        ],
        true,
        true,
      );

      repositorioMock.buscarTodasComHistorico.mockResolvedValue([os]);

      const resultado = await useCase.executar();

      expect(resultado.esperaAtribuicao.mediaHoras).toBe(2);
      expect(resultado.esperaAtribuicao.totalAmostras).toBe(1);

      expect(resultado.diagnosticoOrcamento.mediaHoras).toBe(3);
      expect(resultado.diagnosticoOrcamento.totalAmostras).toBe(1);

      expect(resultado.aprovacaoCliente.mediaHoras).toBe(4);
      expect(resultado.aprovacaoCliente.totalAmostras).toBe(1);

      expect(resultado.execucao.mediaHoras).toBe(5);
      expect(resultado.execucao.totalAmostras).toBe(1);

      expect(resultado.esperaEntrega.mediaHoras).toBe(2);
      expect(resultado.esperaEntrega.totalAmostras).toBe(1);

      expect(resultado.leadTimeTotal.mediaHoras).toBe(16);
      expect(resultado.leadTimeTotal.totalAmostras).toBe(1);

      expect(resultado.tempoTecnicoLiquido.mediaHoras).toBe(8);
      expect(resultado.tempoTecnicoLiquido.totalAmostras).toBe(1);

      expect(resultado.taxaAprovacaoOrcamento).toBe(100);
    });
  });

  describe('taxa de aprovação de orçamentos', () => {
    it('deve calcular 50% quando metade dos orçamentos é aprovada', async () => {
      const osAprovada = criarOSComHistorico(
        [{ evento: 'ORDEM_ABERTA', horasDesdeBase: 0 }],
        true,
        true,
      );
      const osRejeitada = criarOSComHistorico(
        [{ evento: 'ORDEM_ABERTA', horasDesdeBase: 0 }],
        true,
        false,
      );

      repositorioMock.buscarTodasComHistorico.mockResolvedValue([
        osAprovada,
        osRejeitada,
      ]);

      const resultado = await useCase.executar();

      expect(resultado.taxaAprovacaoOrcamento).toBe(50);
    });

    it('deve retornar 0 quando nenhuma OS tem orçamento', async () => {
      const os = criarOSComHistorico(
        [{ evento: 'ORDEM_ABERTA', horasDesdeBase: 0 }],
        false,
      );
      repositorioMock.buscarTodasComHistorico.mockResolvedValue([os]);

      const resultado = await useCase.executar();
      expect(resultado.taxaAprovacaoOrcamento).toBe(0);
    });
  });

  describe('com OS parciais (eventos ausentes)', () => {
    it('deve calcular apenas os segmentos disponíveis', async () => {
      // OS parada em ATRIBUIDA — só tem espera de atribuição
      const os = criarOSComHistorico([
        { evento: 'ORDEM_ABERTA', horasDesdeBase: 0 },
        { evento: 'MECANICO_ATRIBUIDO', horasDesdeBase: 3 },
      ]);

      repositorioMock.buscarTodasComHistorico.mockResolvedValue([os]);

      const resultado = await useCase.executar();

      expect(resultado.esperaAtribuicao.totalAmostras).toBe(1);
      expect(resultado.esperaAtribuicao.mediaHoras).toBe(3);

      // Segmentos sem eventos não contribuem
      expect(resultado.diagnosticoOrcamento.totalAmostras).toBe(0);
      expect(resultado.leadTimeTotal.totalAmostras).toBe(0);
      expect(resultado.tempoTecnicoLiquido.totalAmostras).toBe(0);
    });
  });

  describe('mínimo e máximo com múltiplas OS', () => {
    it('deve retornar o menor e maior valor corretos', async () => {
      const os1 = criarOSComHistorico([
        { evento: 'ORDEM_ABERTA', horasDesdeBase: 0 },
        { evento: 'MECANICO_ATRIBUIDO', horasDesdeBase: 1 },
      ]);
      const os2 = criarOSComHistorico([
        { evento: 'ORDEM_ABERTA', horasDesdeBase: 0 },
        { evento: 'MECANICO_ATRIBUIDO', horasDesdeBase: 5 },
      ]);

      repositorioMock.buscarTodasComHistorico.mockResolvedValue([os1, os2]);

      const resultado = await useCase.executar();

      expect(resultado.esperaAtribuicao.minimoHoras).toBe(1);
      expect(resultado.esperaAtribuicao.maximoHoras).toBe(5);
      expect(resultado.esperaAtribuicao.mediaHoras).toBe(3);
      expect(resultado.esperaAtribuicao.totalAmostras).toBe(2);
    });
  });
});
