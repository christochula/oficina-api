import { Inject, Injectable } from '@nestjs/common';
import { ClienteId } from '../../../cliente/domain/cliente-id.value-object';
import {
  CLIENTE_REPOSITORY,
  type ClienteRepository,
} from '../../../cliente/domain/cliente.repository';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import {
  NOTIFICACAO_ORCAMENTO_GATEWAY,
  type NotificacaoOrcamentoGateway,
} from '../portas/notificacao-orcamento.gateway';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';
import { GrupoOrcamentoInput } from '../../domain/value-objects/grupo-orcamento.vo';

/**
 * Dados de entrada para geração de orçamento de uma OS.
 */
export interface GerarOrcamentoInput {
  /** ID da OS para a qual o orçamento será gerado. */
  osId: string;
  /** ID do mecânico responsável que está gerando o orçamento. */
  mecanicoId: string;
  /** Grupos de itens do orçamento, cada um com título livre e linhas de serviço. */
  grupos: GrupoOrcamentoInput[];
  /** Notas internas do mecânico — não visíveis ao cliente. */
  notasInternas?: string;
  /** Notas enviadas ao cliente junto com o orçamento. */
  notasCliente?: string;
}

/**
 * Caso de uso responsável por gerar o orçamento de uma OS.
 * Avança o status da OS para AGUARDANDO_APROVACAO.
 * O orçamento é organizado em grupos temáticos (ex: "Retífica do Motor"),
 * cada um contendo linhas de MATERIAL e/ou SERVICO.
 */
@Injectable()
export class GerarOrcamentoUseCase {
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
    @Inject(NOTIFICACAO_ORCAMENTO_GATEWAY)
    private readonly notificacaoGateway: NotificacaoOrcamentoGateway,
  ) {}

  async executar(input: GerarOrcamentoInput): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(
      OrdemServicoId.de(input.osId),
    );
    if (!os) throw new RecursoNaoEncontrado('Ordem de Serviço', input.osId);

    os.gerarOrcamento(input.grupos, input.mecanicoId, {
      notasInternas: input.notasInternas,
      notasCliente: input.notasCliente,
    });
    await this.osRepository.salvar(os);

    const cliente = await this.clienteRepository.buscarPorId(
      ClienteId.de(os.clienteId),
    );
    if (cliente?.email) {
      try {
        await this.notificacaoGateway.enviarParaAprovacao({
          osId: os.id.valor,
          osNumero: os.numero,
          valorTotal: os.orcamento?.total ?? 0,
        });
      } catch {
        // The adapter emits a Datadog integration error. The persisted OS remains valid.
      }
    }

    return os;
  }
}
