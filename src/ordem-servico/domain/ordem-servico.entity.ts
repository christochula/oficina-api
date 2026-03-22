import { EntidadeBase } from '../../shared/domain/entidade-base';
import { RegraDeNegocio } from '../../shared/excecoes/dominio.exception';
import { UsuarioId } from '../../usuario/domain/usuario-id.value-object';
import { PapelUsuario } from '../../usuario/domain/papel-usuario.enum';
import { Usuario } from '../../usuario/domain/usuario.entity';
import { ConsumoPecaEvento } from './eventos/consumo-peca.evento';
import { OrdemServicoId } from './ordem-servico-id.value-object';
import { StatusOrdemServico } from './status-ordem-servico.enum';
import { GrupoOrcamento, GrupoOrcamentoInput } from './value-objects/grupo-orcamento.vo';
import { LinhaServico } from './value-objects/linha-servico.vo';
import { Orcamento } from './value-objects/orcamento.vo';

/**
 * Representa um problema relatado pelo cliente ao abrir a OS.
 * Texto livre — captura a percepção do cliente sobre o comportamento anormal do veículo.
 */
export interface ProblemaRelatado {
  /** Identificador do problema no banco de dados (gerado via cuid). */
  id?: string;
  /** Descrição do problema ou sintoma relatado em texto livre. */
  descricao: string;
}

/**
 * Representa um serviço específico solicitado pelo cliente ao abrir a OS.
 * Referencia um serviço do catálogo da oficina (ServicoOficina).
 */
export interface ServicoSolicitado {
  /** Identificador do registro no banco de dados (gerado via cuid). */
  id?: string;
  /** ID do serviço no catálogo da oficina (ServicoOficinaId). */
  servicoId: string;
  /** Snapshot do nome do serviço no catálogo no momento da abertura da OS. */
  nomeServico: string;
  /** Contexto adicional fornecido pelo cliente (ex: "última troca há 10.000 km"). */
  observacao?: string | null;
}

/**
 * Representa uma entrada no histórico de eventos da OS.
 */
export interface HistoricoOSItem {
  /** Identificador da entrada no banco de dados (gerado via cuid). */
  id?: string;
  /** Código do evento que ocorreu. */
  evento: string;
  /** Descrição adicional sobre o evento (opcional). */
  descricao?: string;
  /** ID do usuário que realizou a operação (opcional). */
  usuarioId?: string;
  /** Data e hora em que o evento foi registrado. */
  criadoEm?: Date;
}

/**
 * Representa o registro de consumo de uma peça do estoque durante a execução da OS.
 */
export interface ConsumoPecaRegistro {
  /** Identificador do consumo no banco de dados (gerado via cuid). */
  id?: string;
  /** ID da peça consumida no aggregate Estoque. */
  pecaId: string;
  /** Quantidade de unidades da peça consumidas. */
  quantidade: number;
  /** Data e hora do consumo. */
  criadoEm?: Date;
}

/**
 * Interface interna com as propriedades para construção e reconstituição da OrdemServico.
 */
interface PropriedadesOrdemServico {
  id?: OrdemServicoId;
  numero?: number;
  status?: StatusOrdemServico;
  clienteId: string;
  veiculoId: string;
  mecanicoResponsavelId?: string | null;
  problemasRelatados?: ProblemaRelatado[];
  servicosSolicitados?: ServicoSolicitado[];
  notasInternas?: string | null;
  notasCliente?: string | null;
  diagnostico?: { id?: string; descricao: string } | null;
  orcamento?: Orcamento | null;
  historico?: HistoricoOSItem[];
  consumosPeca?: ConsumoPecaRegistro[];
  criadoEm?: Date;
  atualizadoEm?: Date;
}

/**
 * Aggregate Root central do sistema de oficina mecânica.
 *
 * Representa o ciclo de vida completo de um atendimento: desde a abertura
 * até a entrega do veículo ao cliente. Concentra todas as regras de negócio
 * relativas às transições de estado, validações de papéis e registro de histórico.
 *
 * Ciclo de vida:
 * RECEBIDA → ATRIBUIDA → EM_DIAGNOSTICO* → AGUARDANDO_APROVACAO → APROVADA → EM_EXECUCAO → FINALIZADA → ENTREGUE
 *                                                                   ↘ CANCELADA (rejeição do orçamento)
 *
 * * EM_DIAGNOSTICO é opcional.
 */
export class OrdemServico extends EntidadeBase<OrdemServicoId> {
  numero: number;
  status: StatusOrdemServico;
  readonly clienteId: string;
  readonly veiculoId: string;
  mecanicoResponsavelId: string | null;
  problemasRelatados: ProblemaRelatado[];
  /** Serviços selecionados do catálogo da oficina com contexto opcional do cliente. */
  servicosSolicitados: ServicoSolicitado[];
  /** Notas internas da oficina — não visíveis ao cliente. */
  notasInternas: string | null;
  /** Notas visíveis ao cliente — ex: orientações pós-entrega. */
  notasCliente: string | null;
  diagnostico: { id?: string; descricao: string } | null;
  orcamento: Orcamento | null;
  historico: HistoricoOSItem[];
  consumosPeca: ConsumoPecaRegistro[];

  private _eventos: ConsumoPecaEvento[] = [];

  get eventos(): ConsumoPecaEvento[] { return this._eventos; }
  limparEventos(): void { this._eventos = []; }

  private constructor(props: PropriedadesOrdemServico) {
    super(props.id ?? OrdemServicoId.novo(), props.criadoEm, props.atualizadoEm);
    this.numero = props.numero ?? 0;
    this.status = props.status ?? StatusOrdemServico.RECEBIDA;
    this.clienteId = props.clienteId;
    this.veiculoId = props.veiculoId;
    this.mecanicoResponsavelId = props.mecanicoResponsavelId ?? null;
    this.problemasRelatados = props.problemasRelatados ?? [];
    this.servicosSolicitados = props.servicosSolicitados ?? [];
    this.notasInternas = props.notasInternas ?? null;
    this.notasCliente = props.notasCliente ?? null;
    this.diagnostico = props.diagnostico ?? null;
    this.orcamento = props.orcamento ?? null;
    this.historico = props.historico ?? [];
    this.consumosPeca = props.consumosPeca ?? [];
  }

  /**
   * Cria uma nova Ordem de Serviço com status RECEBIDA.
   * A OS deve ter ao menos um problema relatado ou um serviço solicitado.
   */
  static abrir(props: {
    clienteId: string;
    veiculoId: string;
    problemasRelatados?: ProblemaRelatado[];
    servicosSolicitados?: ServicoSolicitado[];
    notasInternas?: string;
    notasCliente?: string;
    usuarioId?: string;
  }): OrdemServico {
    const temConteudo =
      (props.problemasRelatados?.length ?? 0) > 0 ||
      (props.servicosSolicitados?.length ?? 0) > 0;

    if (!temConteudo) {
      throw new RegraDeNegocio(
        'A OS deve ter ao menos um problema relatado ou um serviço solicitado',
      );
    }

    const os = new OrdemServico({
      clienteId: props.clienteId,
      veiculoId: props.veiculoId,
      status: StatusOrdemServico.RECEBIDA,
      problemasRelatados: props.problemasRelatados ?? [],
      servicosSolicitados: props.servicosSolicitados ?? [],
      notasInternas: props.notasInternas ?? null,
      notasCliente: props.notasCliente ?? null,
    });

    os.registrarHistorico('ORDEM_ABERTA', 'Ordem de serviço aberta', props.usuarioId);
    return os;
  }

  /**
   * Reconstitui uma OrdemServico a partir dos dados persistidos no banco de dados.
   */
  static reconstituir(props: PropriedadesOrdemServico & { id: OrdemServicoId; numero: number }): OrdemServico {
    return new OrdemServico(props);
  }

  /**
   * Atribui um mecânico responsável à OS e avança o status para ATRIBUIDA.
   */
  atribuirMecanico(mecanico: Usuario): void {
    this.garantirStatus([StatusOrdemServico.RECEBIDA]);
    if (mecanico.papel !== PapelUsuario.MECANICO) {
      throw new RegraDeNegocio('Somente um mecânico pode ser atribuído à ordem de serviço');
    }
    this.mecanicoResponsavelId = mecanico.id.valor;
    this.status = StatusOrdemServico.ATRIBUIDA;
    this.registrarHistorico('MECANICO_ATRIBUIDO', `RECEBIDA → ATRIBUIDA | Mecânico ${mecanico.nome} atribuído`, mecanico.id.valor);
    this.tocarAtualizadoEm();
  }

  /**
   * Avança a OS para o status EM_DIAGNOSTICO.
   */
  iniciarDiagnostico(mecanicoId: string): void {
    this.garantirStatus([StatusOrdemServico.ATRIBUIDA]);
    this.status = StatusOrdemServico.EM_DIAGNOSTICO;
    this.registrarHistorico('DIAGNOSTICO_REGISTRADO', 'ATRIBUIDA → EM_DIAGNOSTICO', mecanicoId);
    this.tocarAtualizadoEm();
  }

  /**
   * Registra o texto do diagnóstico técnico.
   */
  registrarDiagnostico(descricao: string, mecanicoId: string): void {
    this.garantirStatus([StatusOrdemServico.EM_DIAGNOSTICO]);
    this.diagnostico = { descricao };
    this.registrarHistorico('DIAGNOSTICO_REGISTRADO', descricao, mecanicoId);
    this.tocarAtualizadoEm();
  }

  /**
   * Gera o orçamento da OS organizado em grupos e avança para AGUARDANDO_APROVACAO.
   *
   * O orçamento é composto por grupos temáticos (ex: "Retífica do Motor"),
   * cada um contendo linhas de MATERIAL e/ou SERVICO com seus custos.
   *
   * @param grupos - Lista de grupos com título e linhas de serviço.
   * @param mecanicoId - ID do mecânico que está gerando o orçamento.
   * @param notas - Notas internas e para o cliente (opcionais).
   */
  gerarOrcamento(
    grupos: GrupoOrcamentoInput[],
    mecanicoId: string,
    notas?: { notasInternas?: string; notasCliente?: string },
  ): void {
    this.garantirStatus([StatusOrdemServico.ATRIBUIDA, StatusOrdemServico.EM_DIAGNOSTICO]);
    if (grupos.length === 0) {
      throw new RegraDeNegocio('O orçamento deve ter ao menos um grupo de serviços');
    }
    if (grupos.some((g) => g.linhas.length === 0)) {
      throw new RegraDeNegocio('Cada grupo do orçamento deve ter ao menos uma linha de serviço');
    }

    const gruposOrcamento = grupos.map(
      (g, idx) =>
        new GrupoOrcamento({
          titulo: g.titulo,
          linhasServico: g.linhas.map((l) => new LinhaServico(l)),
          ordem: idx,
        }),
    );

    const statusAnterior = this.status;
    this.orcamento = new Orcamento({
      grupos: gruposOrcamento,
      notasInternas: notas?.notasInternas,
      notasCliente: notas?.notasCliente,
    });
    this.status = StatusOrdemServico.AGUARDANDO_APROVACAO;
    this.registrarHistorico(
      'ORCAMENTO_GERADO',
      `${statusAnterior} → AGUARDANDO_APROVACAO | Total: R$ ${this.orcamento.total.toFixed(2)}`,
      mecanicoId,
    );
    this.tocarAtualizadoEm();
  }

  /**
   * Registra a aprovação do orçamento e avança para APROVADA.
   */
  aprovarOrcamento(usuarioId: string): void {
    this.garantirStatus([StatusOrdemServico.AGUARDANDO_APROVACAO]);
    if (!this.orcamento) throw new RegraDeNegocio('Não existe orçamento para aprovar');
    this.orcamento.aprovadoEm = new Date();
    this.status = StatusOrdemServico.APROVADA;
    this.registrarHistorico('ORCAMENTO_APROVADO', 'AGUARDANDO_APROVACAO → APROVADA', usuarioId);
    this.tocarAtualizadoEm();
  }

  /**
   * Registra a rejeição do orçamento e avança para CANCELADA.
   */
  rejeitarOrcamento(usuarioId: string): void {
    this.garantirStatus([StatusOrdemServico.AGUARDANDO_APROVACAO]);
    if (!this.orcamento) throw new RegraDeNegocio('Não existe orçamento para rejeitar');
    this.orcamento.rejeitadoEm = new Date();
    this.status = StatusOrdemServico.CANCELADA;
    this.registrarHistorico('ORCAMENTO_REJEITADO', 'AGUARDANDO_APROVACAO → CANCELADA', usuarioId);
    this.tocarAtualizadoEm();
  }

  /**
   * Inicia a execução dos serviços aprovados e avança para EM_EXECUCAO.
   */
  iniciarExecucao(mecanicoId: string): void {
    this.garantirStatus([StatusOrdemServico.APROVADA]);
    this.status = StatusOrdemServico.EM_EXECUCAO;
    this.registrarHistorico('EXECUCAO_INICIADA', 'APROVADA → EM_EXECUCAO', mecanicoId);
    this.tocarAtualizadoEm();
  }

  /**
   * Registra o consumo de uma peça do estoque durante a execução da OS.
   */
  registrarConsumoPeca(pecaId: string, quantidade: number, mecanicoId: string): void {
    this.garantirStatus([StatusOrdemServico.EM_EXECUCAO]);
    if (quantidade <= 0) throw new RegraDeNegocio('Quantidade deve ser maior que zero');

    this.consumosPeca.push({ pecaId, quantidade });
    this._eventos.push(new ConsumoPecaEvento(this.id.valor, pecaId, quantidade));
    this.registrarHistorico('PECA_CONSUMIDA', `Peça ${pecaId} (qtd: ${quantidade})`, mecanicoId);
    this.tocarAtualizadoEm();
  }

  /**
   * Conclui tecnicamente a OS e avança para FINALIZADA.
   */
  finalizar(mecanicoId: string): void {
    this.garantirStatus([StatusOrdemServico.EM_EXECUCAO]);
    this.status = StatusOrdemServico.FINALIZADA;
    this.registrarHistorico('ORDEM_FINALIZADA', 'EM_EXECUCAO → FINALIZADA', mecanicoId);
    this.tocarAtualizadoEm();
  }

  /**
   * Registra a entrega do veículo e avança para ENTREGUE (estado terminal).
   */
  entregarVeiculo(consultorId: string): void {
    this.garantirStatus([StatusOrdemServico.FINALIZADA]);
    this.status = StatusOrdemServico.ENTREGUE;
    this.registrarHistorico('VEICULO_ENTREGUE', 'FINALIZADA → ENTREGUE', consultorId);
    this.tocarAtualizadoEm();
  }

  private garantirStatus(permitidos: StatusOrdemServico[]): void {
    if (!permitidos.includes(this.status)) {
      throw new RegraDeNegocio(
        `Operação inválida para OS no status '${this.status}'. Status permitidos: ${permitidos.join(', ')}`,
      );
    }
  }

  private registrarHistorico(evento: string, descricao?: string, usuarioId?: string): void {
    this.historico.push({ evento, descricao, usuarioId, criadoEm: new Date() });
  }
}
