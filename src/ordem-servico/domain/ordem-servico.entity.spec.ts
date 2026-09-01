import { OrdemServico } from './ordem-servico.entity';
import { StatusOrdemServico } from './status-ordem-servico.enum';
import {
  AcessoNegado,
  RegraDeNegocio,
} from '../../shared/excecoes/dominio.exception';
import { Usuario } from '../../usuario/domain/usuario.entity';
import { UsuarioId } from '../../usuario/domain/usuario-id.value-object';
import { PapelUsuario } from '../../usuario/domain/papel-usuario.enum';
import { TipoLinhaServico } from './value-objects/linha-servico.vo';
import { OrdemServicoId } from './ordem-servico-id.value-object';

function criarMecanico(): Usuario {
  const agora = new Date();
  return Usuario.reconstituir({
    id: UsuarioId.de('us_01'),
    nome: 'Carlos Mecânico',
    email: 'carlos@oficina.com',
    senhaHash: 'hash',
    papel: PapelUsuario.MECANICO,
    refreshTokenHash: null,
    ativo: true,
    criadoEm: agora,
    atualizadoEm: agora,
  });
}

function criarConsultor(): Usuario {
  return Usuario.criar({
    nome: 'Ana Consultora',
    email: 'ana@oficina.com',
    senhaHash: 'hash',
    papel: PapelUsuario.CONSULTOR_TECNICO,
  });
}

function osRecebida(): OrdemServico {
  return OrdemServico.abrir({
    clienteId: 'cl_01',
    veiculoId: 've_01',
    problemasRelatados: [{ descricao: 'Motor falhando' }],
  });
}

function osAtribuida(): OrdemServico {
  const os = osRecebida();
  os.atribuirMecanico(criarMecanico());
  return os;
}

function osEmDiagnostico(): OrdemServico {
  const os = osAtribuida();
  os.iniciarDiagnostico('us_01');
  return os;
}

function osAguardandoAprovacao(): OrdemServico {
  const os = osAtribuida();
  os.gerarOrcamento(
    [
      {
        titulo: 'Serviços',
        linhas: [
          {
            tipo: TipoLinhaServico.SERVICO,
            descricao: 'Troca de óleo',
            quantidade: 1,
            valorUnitario: 150,
          },
        ],
      },
    ],
    'us_01',
  );
  return os;
}

function osAprovada(): OrdemServico {
  const os = osAguardandoAprovacao();
  os.aprovarOrcamento('us_cliente');
  return os;
}

function osEmExecucao(): OrdemServico {
  const os = osAprovada();
  os.iniciarExecucao('us_01');
  return os;
}

function osFinalizada(): OrdemServico {
  const os = osEmExecucao();
  os.finalizar('us_01');
  return os;
}

describe('OrdemServico', () => {
  describe('abrir()', () => {
    it('deve criar OS com status RECEBIDA', () => {
      const os = osRecebida();
      expect(os.status).toBe(StatusOrdemServico.RECEBIDA);
    });

    it('deve lançar RegraDeNegocio se não houver problemas nem serviços', () => {
      expect(() =>
        OrdemServico.abrir({ clienteId: 'cl_01', veiculoId: 've_01' }),
      ).toThrow(RegraDeNegocio);
    });

    it('deve aceitar OS com apenas serviços solicitados', () => {
      const os = OrdemServico.abrir({
        clienteId: 'cl_01',
        veiculoId: 've_01',
        servicosSolicitados: [
          { servicoId: 'sv_01', nomeServico: 'Troca de pneus' },
        ],
      });
      expect(os.status).toBe(StatusOrdemServico.RECEBIDA);
    });

    it('deve registrar ORDEM_ABERTA no histórico', () => {
      const os = osRecebida();
      const evento = os.historico.find((h) => h.evento === 'ORDEM_ABERTA');
      expect(evento).toBeDefined();
    });

    it('deve registrar ORDEM_ABERTA com statusAnterior null e statusNovo RECEBIDA', () => {
      const os = osRecebida();
      const evento = os.historico.find((h) => h.evento === 'ORDEM_ABERTA');
      expect(evento?.statusAnterior).toBeNull();
      expect(evento?.statusNovo).toBe(StatusOrdemServico.RECEBIDA);
    });

    it('deve atribuir clienteId e veiculoId corretamente', () => {
      const os = osRecebida();
      expect(os.clienteId).toBe('cl_01');
      expect(os.veiculoId).toBe('ve_01');
    });

    it('deve iniciar com mecanicoResponsavelId nulo', () => {
      const os = osRecebida();
      expect(os.mecanicoResponsavelId).toBeNull();
    });
  });

  describe('reconstituir()', () => {
    it('deve reconstituir OS com todos os dados', () => {
      const id = OrdemServicoId.novo();
      const os = OrdemServico.reconstituir({
        id,
        numero: 42,
        clienteId: 'cl_01',
        veiculoId: 've_01',
        status: StatusOrdemServico.ATRIBUIDA,
      });
      expect(os.id).toBe(id);
      expect(os.numero).toBe(42);
      expect(os.status).toBe(StatusOrdemServico.ATRIBUIDA);
    });
  });

  describe('atribuirMecanico()', () => {
    it('deve mudar status para ATRIBUIDA', () => {
      const os = osRecebida();
      os.atribuirMecanico(criarMecanico());
      expect(os.status).toBe(StatusOrdemServico.ATRIBUIDA);
    });

    it('deve lançar RegraDeNegocio se usuário não for mecânico', () => {
      const os = osRecebida();
      const consultor = criarConsultor();
      expect(() => os.atribuirMecanico(consultor)).toThrow(RegraDeNegocio);
    });

    it('deve lançar RegraDeNegocio se OS não estiver no status RECEBIDA', () => {
      const os = osAtribuida();
      expect(() => os.atribuirMecanico(criarMecanico())).toThrow(
        RegraDeNegocio,
      );
    });

    it('deve registrar MECANICO_ATRIBUIDO no histórico com texto RECEBIDA → ATRIBUIDA', () => {
      const os = osRecebida();
      os.atribuirMecanico(criarMecanico());
      const evento = os.historico.find(
        (h) => h.evento === 'MECANICO_ATRIBUIDO',
      );
      expect(evento).toBeDefined();
      expect(evento?.descricao).toContain('RECEBIDA → ATRIBUIDA');
    });

    it('deve registrar MECANICO_ATRIBUIDO com statusAnterior RECEBIDA e statusNovo ATRIBUIDA', () => {
      const os = osRecebida();
      os.atribuirMecanico(criarMecanico());
      const evento = os.historico.find(
        (h) => h.evento === 'MECANICO_ATRIBUIDO',
      );
      expect(evento?.statusAnterior).toBe(StatusOrdemServico.RECEBIDA);
      expect(evento?.statusNovo).toBe(StatusOrdemServico.ATRIBUIDA);
    });

    it('deve preencher mecanicoResponsavelId', () => {
      const os = osRecebida();
      const mecanico = criarMecanico();
      os.atribuirMecanico(mecanico);
      expect(os.mecanicoResponsavelId).toBe(mecanico.id.valor);
    });
  });

  describe('iniciarDiagnostico()', () => {
    it('deve mudar status para EM_DIAGNOSTICO', () => {
      const os = osAtribuida();
      os.iniciarDiagnostico('us_01');
      expect(os.status).toBe(StatusOrdemServico.EM_DIAGNOSTICO);
    });

    it('deve negar operação quando a OS ainda não tem mecânico', () => {
      const os = osRecebida();
      expect(() => os.iniciarDiagnostico('us_01')).toThrow(AcessoNegado);
    });

    it('deve registrar DIAGNOSTICO_REGISTRADO no histórico', () => {
      const os = osAtribuida();
      os.iniciarDiagnostico('us_01');
      const evento = os.historico.find(
        (h) => h.evento === 'DIAGNOSTICO_REGISTRADO',
      );
      expect(evento).toBeDefined();
    });

    it('deve registrar DIAGNOSTICO_REGISTRADO com statusAnterior ATRIBUIDA e statusNovo EM_DIAGNOSTICO', () => {
      const os = osAtribuida();
      os.iniciarDiagnostico('us_01');
      const evento = os.historico.find(
        (h) => h.evento === 'DIAGNOSTICO_REGISTRADO',
      );
      expect(evento?.statusAnterior).toBe(StatusOrdemServico.ATRIBUIDA);
      expect(evento?.statusNovo).toBe(StatusOrdemServico.EM_DIAGNOSTICO);
    });
  });

  describe('registrarDiagnostico()', () => {
    it('deve salvar o diagnóstico', () => {
      const os = osEmDiagnostico();
      os.registrarDiagnostico('Motor com desgaste nos anéis', 'us_01');
      expect(os.diagnostico?.descricao).toBe('Motor com desgaste nos anéis');
    });

    it('deve lançar RegraDeNegocio se OS não estiver EM_DIAGNOSTICO', () => {
      const os = osAtribuida();
      expect(() => os.registrarDiagnostico('Diagnóstico', 'us_01')).toThrow(
        RegraDeNegocio,
      );
    });
  });

  describe('gerarOrcamento()', () => {
    const grupos = [
      {
        titulo: 'Serviços',
        linhas: [
          {
            tipo: TipoLinhaServico.SERVICO,
            descricao: 'Troca de óleo',
            quantidade: 1,
            valorUnitario: 150,
          },
        ],
      },
    ];

    it('deve mudar status para AGUARDANDO_APROVACAO quando ATRIBUIDA', () => {
      const os = osAtribuida();
      os.gerarOrcamento(grupos, 'us_01');
      expect(os.status).toBe(StatusOrdemServico.AGUARDANDO_APROVACAO);
    });

    it('deve mudar status para AGUARDANDO_APROVACAO quando EM_DIAGNOSTICO', () => {
      const os = osEmDiagnostico();
      os.gerarOrcamento(grupos, 'us_01');
      expect(os.status).toBe(StatusOrdemServico.AGUARDANDO_APROVACAO);
    });

    it('deve lançar RegraDeNegocio se lista de grupos estiver vazia', () => {
      const os = osAtribuida();
      expect(() => os.gerarOrcamento([], 'us_01')).toThrow(RegraDeNegocio);
    });

    it('deve negar operação quando a OS ainda não tem mecânico', () => {
      const os = osRecebida();
      expect(() => os.gerarOrcamento(grupos, 'us_01')).toThrow(AcessoNegado);
    });

    it('deve criar orçamento com total correto', () => {
      const os = osAtribuida();
      os.gerarOrcamento(grupos, 'us_01');
      expect(os.orcamento?.total).toBe(150);
    });

    it('deve registrar ORCAMENTO_GERADO no histórico', () => {
      const os = osAtribuida();
      os.gerarOrcamento(grupos, 'us_01');
      const evento = os.historico.find((h) => h.evento === 'ORCAMENTO_GERADO');
      expect(evento).toBeDefined();
    });

    it('deve registrar ORCAMENTO_GERADO com statusAnterior ATRIBUIDA e statusNovo AGUARDANDO_APROVACAO', () => {
      const os = osAtribuida();
      os.gerarOrcamento(grupos, 'us_01');
      const evento = os.historico.find((h) => h.evento === 'ORCAMENTO_GERADO');
      expect(evento?.statusAnterior).toBe(StatusOrdemServico.ATRIBUIDA);
      expect(evento?.statusNovo).toBe(StatusOrdemServico.AGUARDANDO_APROVACAO);
    });

    it('deve registrar ORCAMENTO_GERADO com statusAnterior EM_DIAGNOSTICO quando veio do diagnóstico', () => {
      const os = osEmDiagnostico();
      os.gerarOrcamento(grupos, 'us_01');
      const evento = os.historico.find((h) => h.evento === 'ORCAMENTO_GERADO');
      expect(evento?.statusAnterior).toBe(StatusOrdemServico.EM_DIAGNOSTICO);
      expect(evento?.statusNovo).toBe(StatusOrdemServico.AGUARDANDO_APROVACAO);
    });
  });

  describe('autorização do mecânico responsável', () => {
    const operacoes: Array<[string, () => void]> = [
      [
        'início do diagnóstico',
        () => osAtribuida().iniciarDiagnostico('us_outro'),
      ],
      [
        'registro do diagnóstico',
        () => osEmDiagnostico().registrarDiagnostico('Diagnóstico', 'us_outro'),
      ],
      [
        'geração do orçamento',
        () => osAtribuida().gerarOrcamento([], 'us_outro'),
      ],
      ['início da execução', () => osAprovada().iniciarExecucao('us_outro')],
      [
        'consumo de peça',
        () => osEmExecucao().registrarConsumoPeca('pc_01', 1, 'us_outro'),
      ],
      ['finalização', () => osEmExecucao().finalizar('us_outro')],
    ];

    it.each(operacoes)('deve negar outro mecânico em %s', (_nome, executar) => {
      expect(executar).toThrow(AcessoNegado);
    });
  });

  describe('aprovarOrcamento()', () => {
    it('deve mudar status para APROVADA', () => {
      const os = osAguardandoAprovacao();
      os.aprovarOrcamento('us_cliente');
      expect(os.status).toBe(StatusOrdemServico.APROVADA);
    });

    it('deve lançar RegraDeNegocio se OS não estiver AGUARDANDO_APROVACAO', () => {
      const os = osAtribuida();
      expect(() => os.aprovarOrcamento('us_cliente')).toThrow(RegraDeNegocio);
    });

    it('deve preencher orcamento.aprovadoEm', () => {
      const os = osAguardandoAprovacao();
      os.aprovarOrcamento('us_cliente');
      expect(os.orcamento?.aprovadoEm).toBeInstanceOf(Date);
    });

    it('deve registrar ORCAMENTO_APROVADO no histórico', () => {
      const os = osAguardandoAprovacao();
      os.aprovarOrcamento('us_cliente');
      const evento = os.historico.find(
        (h) => h.evento === 'ORCAMENTO_APROVADO',
      );
      expect(evento).toBeDefined();
    });

    it('deve registrar ORCAMENTO_APROVADO com statusAnterior AGUARDANDO_APROVACAO e statusNovo APROVADA', () => {
      const os = osAguardandoAprovacao();
      os.aprovarOrcamento('us_cliente');
      const evento = os.historico.find(
        (h) => h.evento === 'ORCAMENTO_APROVADO',
      );
      expect(evento?.statusAnterior).toBe(
        StatusOrdemServico.AGUARDANDO_APROVACAO,
      );
      expect(evento?.statusNovo).toBe(StatusOrdemServico.APROVADA);
    });
  });

  describe('rejeitarOrcamento()', () => {
    it('deve mudar status para CANCELADA', () => {
      const os = osAguardandoAprovacao();
      os.rejeitarOrcamento('us_cliente');
      expect(os.status).toBe(StatusOrdemServico.CANCELADA);
    });

    it('deve lançar RegraDeNegocio se OS não estiver AGUARDANDO_APROVACAO', () => {
      const os = osAprovada();
      expect(() => os.rejeitarOrcamento('us_cliente')).toThrow(RegraDeNegocio);
    });

    it('deve preencher orcamento.rejeitadoEm', () => {
      const os = osAguardandoAprovacao();
      os.rejeitarOrcamento('us_cliente');
      expect(os.orcamento?.rejeitadoEm).toBeInstanceOf(Date);
    });

    it('deve registrar ORCAMENTO_REJEITADO no histórico', () => {
      const os = osAguardandoAprovacao();
      os.rejeitarOrcamento('us_cliente');
      const evento = os.historico.find(
        (h) => h.evento === 'ORCAMENTO_REJEITADO',
      );
      expect(evento).toBeDefined();
    });

    it('deve registrar ORCAMENTO_REJEITADO com statusAnterior AGUARDANDO_APROVACAO e statusNovo CANCELADA', () => {
      const os = osAguardandoAprovacao();
      os.rejeitarOrcamento('us_cliente');
      const evento = os.historico.find(
        (h) => h.evento === 'ORCAMENTO_REJEITADO',
      );
      expect(evento?.statusAnterior).toBe(
        StatusOrdemServico.AGUARDANDO_APROVACAO,
      );
      expect(evento?.statusNovo).toBe(StatusOrdemServico.CANCELADA);
    });
  });

  describe('iniciarExecucao()', () => {
    it('deve mudar status para EM_EXECUCAO', () => {
      const os = osAprovada();
      os.iniciarExecucao('us_01');
      expect(os.status).toBe(StatusOrdemServico.EM_EXECUCAO);
    });

    it('deve lançar RegraDeNegocio se OS não estiver APROVADA', () => {
      const os = osAguardandoAprovacao();
      expect(() => os.iniciarExecucao('us_01')).toThrow(RegraDeNegocio);
    });

    it('deve registrar EXECUCAO_INICIADA no histórico', () => {
      const os = osAprovada();
      os.iniciarExecucao('us_01');
      const evento = os.historico.find((h) => h.evento === 'EXECUCAO_INICIADA');
      expect(evento).toBeDefined();
    });

    it('deve registrar EXECUCAO_INICIADA com statusAnterior APROVADA e statusNovo EM_EXECUCAO', () => {
      const os = osAprovada();
      os.iniciarExecucao('us_01');
      const evento = os.historico.find((h) => h.evento === 'EXECUCAO_INICIADA');
      expect(evento?.statusAnterior).toBe(StatusOrdemServico.APROVADA);
      expect(evento?.statusNovo).toBe(StatusOrdemServico.EM_EXECUCAO);
    });
  });

  describe('registrarConsumoPeca()', () => {
    it('deve adicionar consumo à lista consumosPeca', () => {
      const os = osEmExecucao();
      os.registrarConsumoPeca('pc_01', 2, 'us_01');
      expect(os.consumosPeca).toHaveLength(1);
      expect(os.consumosPeca[0].pecaId).toBe('pc_01');
      expect(os.consumosPeca[0].quantidade).toBe(2);
    });

    it('deve lançar RegraDeNegocio se OS não estiver EM_EXECUCAO', () => {
      const os = osAprovada();
      expect(() => os.registrarConsumoPeca('pc_01', 1, 'us_01')).toThrow(
        RegraDeNegocio,
      );
    });

    it('deve lançar RegraDeNegocio se quantidade for zero', () => {
      const os = osEmExecucao();
      expect(() => os.registrarConsumoPeca('pc_01', 0, 'us_01')).toThrow(
        RegraDeNegocio,
      );
    });

    it('deve lançar RegraDeNegocio se quantidade for negativa', () => {
      const os = osEmExecucao();
      expect(() => os.registrarConsumoPeca('pc_01', -1, 'us_01')).toThrow(
        RegraDeNegocio,
      );
    });

    it('deve acumular eventos de domínio', () => {
      const os = osEmExecucao();
      os.registrarConsumoPeca('pc_01', 2, 'us_01');
      os.registrarConsumoPeca('pc_02', 3, 'us_01');
      expect(os.eventos).toHaveLength(2);
    });

    it('deve registrar PECA_CONSUMIDA no histórico', () => {
      const os = osEmExecucao();
      os.registrarConsumoPeca('pc_01', 1, 'us_01');
      const evento = os.historico.find((h) => h.evento === 'PECA_CONSUMIDA');
      expect(evento).toBeDefined();
    });

    it('deve registrar PECA_CONSUMIDA com statusAnterior e statusNovo iguais a EM_EXECUCAO', () => {
      const os = osEmExecucao();
      os.registrarConsumoPeca('pc_01', 1, 'us_01');
      const evento = os.historico.find((h) => h.evento === 'PECA_CONSUMIDA');
      expect(evento?.statusAnterior).toBe(StatusOrdemServico.EM_EXECUCAO);
      expect(evento?.statusNovo).toBe(StatusOrdemServico.EM_EXECUCAO);
    });
  });

  describe('limparEventos()', () => {
    it('deve remover todos os eventos acumulados', () => {
      const os = osEmExecucao();
      os.registrarConsumoPeca('pc_01', 1, 'us_01');
      expect(os.eventos).toHaveLength(1);
      os.limparEventos();
      expect(os.eventos).toHaveLength(0);
    });
  });

  describe('finalizar()', () => {
    it('deve mudar status para FINALIZADA', () => {
      const os = osEmExecucao();
      os.finalizar('us_01');
      expect(os.status).toBe(StatusOrdemServico.FINALIZADA);
    });

    it('deve lançar RegraDeNegocio se OS não estiver EM_EXECUCAO', () => {
      const os = osAprovada();
      expect(() => os.finalizar('us_01')).toThrow(RegraDeNegocio);
    });

    it('deve registrar ORDEM_FINALIZADA no histórico', () => {
      const os = osEmExecucao();
      os.finalizar('us_01');
      const evento = os.historico.find((h) => h.evento === 'ORDEM_FINALIZADA');
      expect(evento).toBeDefined();
    });

    it('deve registrar ORDEM_FINALIZADA com statusAnterior EM_EXECUCAO e statusNovo FINALIZADA', () => {
      const os = osEmExecucao();
      os.finalizar('us_01');
      const evento = os.historico.find((h) => h.evento === 'ORDEM_FINALIZADA');
      expect(evento?.statusAnterior).toBe(StatusOrdemServico.EM_EXECUCAO);
      expect(evento?.statusNovo).toBe(StatusOrdemServico.FINALIZADA);
    });
  });

  describe('entregarVeiculo()', () => {
    it('deve mudar status para ENTREGUE', () => {
      const os = osFinalizada();
      os.entregarVeiculo('us_consultor');
      expect(os.status).toBe(StatusOrdemServico.ENTREGUE);
    });

    it('deve lançar RegraDeNegocio se OS não estiver FINALIZADA', () => {
      const os = osEmExecucao();
      expect(() => os.entregarVeiculo('us_consultor')).toThrow(RegraDeNegocio);
    });

    it('deve registrar VEICULO_ENTREGUE no histórico', () => {
      const os = osFinalizada();
      os.entregarVeiculo('us_consultor');
      const evento = os.historico.find((h) => h.evento === 'VEICULO_ENTREGUE');
      expect(evento).toBeDefined();
    });

    it('deve registrar VEICULO_ENTREGUE com statusAnterior FINALIZADA e statusNovo ENTREGUE', () => {
      const os = osFinalizada();
      os.entregarVeiculo('us_consultor');
      const evento = os.historico.find((h) => h.evento === 'VEICULO_ENTREGUE');
      expect(evento?.statusAnterior).toBe(StatusOrdemServico.FINALIZADA);
      expect(evento?.statusNovo).toBe(StatusOrdemServico.ENTREGUE);
    });
  });
});
