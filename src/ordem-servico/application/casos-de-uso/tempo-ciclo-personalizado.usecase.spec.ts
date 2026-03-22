import { TempoCicloPersonalizadoUseCase } from './tempo-ciclo-personalizado.usecase';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

// ── Helpers de teste ──────────────────────────────────────────────────────────

const BASE = new Date('2026-01-01T08:00:00Z');

function h(horas: number): Date {
  return new Date(BASE.getTime() + horas * 60 * 60 * 1000);
}

function criarOS(
  id: string,
  numero: number,
  eventos: { evento: string; horasDesdeBase: number }[],
): OrdemServico {
  return OrdemServico.reconstituir({
    id: OrdemServicoId.de(id),
    numero,
    status: StatusOrdemServico.ENTREGUE,
    clienteId: 'cl-cliente-001',
    veiculoId: 've-veiculo-001',
    mecanicoResponsavelId: null,
    problemasRelatados: [{ descricao: 'Problema' }],
    servicosSolicitados: [],
    diagnostico: null,
    orcamento: null,
    historico: eventos.map(({ evento, horasDesdeBase }) => ({
      id: `h-${evento}`,
      evento,
      criadoEm: h(horasDesdeBase),
    })),
    consumosPeca: [],
    criadoEm: BASE,
    atualizadoEm: BASE,
  });
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('TempoCicloPersonalizadoUseCase', () => {
  let useCase: TempoCicloPersonalizadoUseCase;
  let repositorioMock: { buscarTodasComHistorico: jest.Mock };

  beforeEach(() => {
    repositorioMock = { buscarTodasComHistorico: jest.fn() };
    useCase = new TempoCicloPersonalizadoUseCase(repositorioMock as any);
    Reflect.defineMetadata(ORDEM_SERVICO_REPOSITORY, repositorioMock, useCase);
  });

  describe('sem ordens de serviço', () => {
    it('deve retornar zero amostras', async () => {
      repositorioMock.buscarTodasComHistorico.mockResolvedValue([]);

      const resultado = await useCase.executar({
        eventoInicio: 'MECANICO_ATRIBUIDO',
        eventoFim: 'ORDEM_FINALIZADA',
      });

      expect(resultado.totalAmostras).toBe(0);
      expect(resultado.mediaHoras).toBe(0);
      expect(resultado.ordens).toHaveLength(0);
    });
  });

  describe('sem descontos', () => {
    it('deve calcular a duração bruta entre dois eventos', async () => {
      /**
       * MECANICO_ATRIBUIDO → ORDEM_FINALIZADA = 10h (bruto)
       * Sem descontos → líquido = 10h
       */
      const os = criarOS('os01tempCicloSpec01', 1, [
        { evento: 'MECANICO_ATRIBUIDO', horasDesdeBase: 0 },
        { evento: 'ORCAMENTO_GERADO', horasDesdeBase: 3 },
        { evento: 'ORCAMENTO_APROVADO', horasDesdeBase: 7 },
        { evento: 'EXECUCAO_INICIADA', horasDesdeBase: 7 },
        { evento: 'ORDEM_FINALIZADA', horasDesdeBase: 10 },
      ]);

      repositorioMock.buscarTodasComHistorico.mockResolvedValue([os]);

      const resultado = await useCase.executar({
        eventoInicio: 'MECANICO_ATRIBUIDO',
        eventoFim: 'ORDEM_FINALIZADA',
      });

      expect(resultado.totalAmostras).toBe(1);
      expect(resultado.ordens[0].duracaoBrutaHoras).toBe(10);
      expect(resultado.ordens[0].duracaoLiquidaHoras).toBe(10);
      expect(resultado.ordens[0].totalDescontadoHoras).toBe(0);
    });
  });

  describe('com um desconto', () => {
    it('deve subtrair o intervalo de aprovação do cliente', async () => {
      /**
       * MECANICO_ATRIBUIDO → ORDEM_FINALIZADA = 10h
       * Desconto: ORCAMENTO_GERADO:ORCAMENTO_APROVADO = 4h
       * Líquido = 10 - 4 = 6h
       */
      const os = criarOS('os01tempCicloSpec02', 1, [
        { evento: 'MECANICO_ATRIBUIDO', horasDesdeBase: 0 },
        { evento: 'ORCAMENTO_GERADO', horasDesdeBase: 3 },
        { evento: 'ORCAMENTO_APROVADO', horasDesdeBase: 7 },
        { evento: 'EXECUCAO_INICIADA', horasDesdeBase: 7 },
        { evento: 'ORDEM_FINALIZADA', horasDesdeBase: 10 },
      ]);

      repositorioMock.buscarTodasComHistorico.mockResolvedValue([os]);

      const resultado = await useCase.executar({
        eventoInicio: 'MECANICO_ATRIBUIDO',
        eventoFim: 'ORDEM_FINALIZADA',
        descontar: ['ORCAMENTO_GERADO:ORCAMENTO_APROVADO'],
      });

      expect(resultado.totalAmostras).toBe(1);
      expect(resultado.ordens[0].duracaoBrutaHoras).toBe(10);
      expect(resultado.ordens[0].totalDescontadoHoras).toBe(4);
      expect(resultado.ordens[0].duracaoLiquidaHoras).toBe(6);
      expect(resultado.mediaHoras).toBe(6);
    });
  });

  describe('com múltiplos descontos', () => {
    it('deve acumular todos os descontos corretamente', async () => {
      /**
       * ORDEM_ABERTA → VEICULO_ENTREGUE = 20h
       * Desconto 1: ORDEM_ABERTA:MECANICO_ATRIBUIDO = 2h (espera atribuição)
       * Desconto 2: ORCAMENTO_GERADO:ORCAMENTO_APROVADO = 4h (aprovação cliente)
       * Desconto 3: ORDEM_FINALIZADA:VEICULO_ENTREGUE = 3h (espera entrega)
       * Total descontado = 9h → líquido = 11h
       */
      const os = criarOS('os01tempCicloSpec03', 1, [
        { evento: 'ORDEM_ABERTA', horasDesdeBase: 0 },
        { evento: 'MECANICO_ATRIBUIDO', horasDesdeBase: 2 },
        { evento: 'ORCAMENTO_GERADO', horasDesdeBase: 5 },
        { evento: 'ORCAMENTO_APROVADO', horasDesdeBase: 9 },
        { evento: 'EXECUCAO_INICIADA', horasDesdeBase: 9 },
        { evento: 'ORDEM_FINALIZADA', horasDesdeBase: 17 },
        { evento: 'VEICULO_ENTREGUE', horasDesdeBase: 20 },
      ]);

      repositorioMock.buscarTodasComHistorico.mockResolvedValue([os]);

      const resultado = await useCase.executar({
        eventoInicio: 'ORDEM_ABERTA',
        eventoFim: 'VEICULO_ENTREGUE',
        descontar: [
          'ORDEM_ABERTA:MECANICO_ATRIBUIDO',
          'ORCAMENTO_GERADO:ORCAMENTO_APROVADO',
          'ORDEM_FINALIZADA:VEICULO_ENTREGUE',
        ],
      });

      expect(resultado.ordens[0].duracaoBrutaHoras).toBe(20);
      expect(resultado.ordens[0].totalDescontadoHoras).toBe(9);
      expect(resultado.ordens[0].duracaoLiquidaHoras).toBe(11);
    });
  });

  describe('OS sem os eventos solicitados', () => {
    it('deve ignorar OS que não têm o evento de início', async () => {
      const os = criarOS('os01tempCicloSpec04', 1, [
        { evento: 'ORDEM_ABERTA', horasDesdeBase: 0 },
        { evento: 'ORDEM_FINALIZADA', horasDesdeBase: 10 },
        // sem MECANICO_ATRIBUIDO
      ]);

      repositorioMock.buscarTodasComHistorico.mockResolvedValue([os]);

      const resultado = await useCase.executar({
        eventoInicio: 'MECANICO_ATRIBUIDO',
        eventoFim: 'ORDEM_FINALIZADA',
      });

      expect(resultado.totalAmostras).toBe(0);
    });

    it('deve ignorar OS que não têm o evento de fim', async () => {
      const os = criarOS('os01tempCicloSpec05', 1, [
        { evento: 'ORDEM_ABERTA', horasDesdeBase: 0 },
        { evento: 'MECANICO_ATRIBUIDO', horasDesdeBase: 2 },
        // sem ORDEM_FINALIZADA
      ]);

      repositorioMock.buscarTodasComHistorico.mockResolvedValue([os]);

      const resultado = await useCase.executar({
        eventoInicio: 'MECANICO_ATRIBUIDO',
        eventoFim: 'ORDEM_FINALIZADA',
      });

      expect(resultado.totalAmostras).toBe(0);
    });

    it('deve ignorar o desconto quando um dos eventos do par está ausente', async () => {
      /**
       * OS sem ORCAMENTO_APROVADO → desconto ORCAMENTO_GERADO:ORCAMENTO_APROVADO não se aplica
       * Bruto = 10h, líquido = 10h (desconto ignorado)
       */
      const os = criarOS('os01tempCicloSpec06', 1, [
        { evento: 'MECANICO_ATRIBUIDO', horasDesdeBase: 0 },
        { evento: 'ORCAMENTO_GERADO', horasDesdeBase: 3 },
        // sem ORCAMENTO_APROVADO
        { evento: 'ORDEM_FINALIZADA', horasDesdeBase: 10 },
      ]);

      repositorioMock.buscarTodasComHistorico.mockResolvedValue([os]);

      const resultado = await useCase.executar({
        eventoInicio: 'MECANICO_ATRIBUIDO',
        eventoFim: 'ORDEM_FINALIZADA',
        descontar: ['ORCAMENTO_GERADO:ORCAMENTO_APROVADO'],
      });

      expect(resultado.totalAmostras).toBe(1);
      expect(resultado.ordens[0].duracaoBrutaHoras).toBe(10);
      expect(resultado.ordens[0].totalDescontadoHoras).toBe(0);
      expect(resultado.ordens[0].duracaoLiquidaHoras).toBe(10);
    });
  });

  describe('com múltiplas OS', () => {
    it('deve calcular média, mínimo e máximo corretamente', async () => {
      const os1 = criarOS('os01tempCicloSpec07', 1, [
        { evento: 'MECANICO_ATRIBUIDO', horasDesdeBase: 0 },
        { evento: 'ORDEM_FINALIZADA', horasDesdeBase: 4 }, // 4h
      ]);
      const os2 = criarOS('os01tempCicloSpec08', 2, [
        { evento: 'MECANICO_ATRIBUIDO', horasDesdeBase: 0 },
        { evento: 'ORDEM_FINALIZADA', horasDesdeBase: 8 }, // 8h
      ]);

      repositorioMock.buscarTodasComHistorico.mockResolvedValue([os1, os2]);

      const resultado = await useCase.executar({
        eventoInicio: 'MECANICO_ATRIBUIDO',
        eventoFim: 'ORDEM_FINALIZADA',
      });

      expect(resultado.totalAmostras).toBe(2);
      expect(resultado.minimoHoras).toBe(4);
      expect(resultado.maximoHoras).toBe(8);
      expect(resultado.mediaHoras).toBe(6);
    });
  });

  describe('metadados do resultado', () => {
    it('deve retornar os parâmetros informados na resposta', async () => {
      repositorioMock.buscarTodasComHistorico.mockResolvedValue([]);

      const resultado = await useCase.executar({
        eventoInicio: 'EXECUCAO_INICIADA',
        eventoFim: 'ORDEM_FINALIZADA',
        descontar: ['A:B'],
      });

      expect(resultado.eventoInicio).toBe('EXECUCAO_INICIADA');
      expect(resultado.eventoFim).toBe('ORDEM_FINALIZADA');
      expect(resultado.descontos).toEqual(['A:B']);
    });
  });
});
