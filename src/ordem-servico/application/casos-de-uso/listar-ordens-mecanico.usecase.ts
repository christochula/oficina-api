import { Inject, Injectable } from '@nestjs/common';
import { RespostaPaginadaDto } from '../../../shared/http/dtos/resposta-paginada.dto';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

/**
 * Status nos quais o mecânico tem trabalho ativo sobre a OS.
 * Exclui status finais (FINALIZADA, ENTREGUE, CANCELADA) e RECEBIDA (ainda não atribuída).
 */
const STATUS_ATIVOS_MECANICO: StatusOrdemServico[] = [
  StatusOrdemServico.ATRIBUIDA,
  StatusOrdemServico.EM_DIAGNOSTICO,
  StatusOrdemServico.AGUARDANDO_APROVACAO,
  StatusOrdemServico.APROVADA,
  StatusOrdemServico.EM_EXECUCAO,
];

/**
 * Dados de entrada para listagem das OS ativas de um mecânico.
 */
export interface ListarOrdensMecanicoInput {
  /** ID do mecânico autenticado (extraído do JWT). Filtra apenas suas OS. */
  mecanicoId: string;
  /** Número da página (padrão: 1). */
  pagina?: number;
  /** Quantidade de registros por página (padrão: 20). */
  porPagina?: number;
}

/**
 * Lista as OS atribuídas ao mecânico autenticado que ainda estão em andamento.
 *
 * Retorna apenas OS nos status em que o mecânico tem ação direta:
 * ATRIBUIDA, EM_DIAGNOSTICO, AGUARDANDO_APROVACAO, APROVADA, EM_EXECUCAO.
 *
 * OS finalizadas, entregues ou canceladas não aparecem nesta listagem.
 * Para visualização de OS por ID, use {@link BuscarOrdemServicoPorIdUseCase}.
 */
@Injectable()
export class ListarOrdensMecanicoUseCase {
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  async executar(input: ListarOrdensMecanicoInput): Promise<RespostaPaginadaDto<OrdemServico>> {
    const pagina = input.pagina ?? 1;
    const porPagina = input.porPagina ?? 20;

    const { itens, total } = await this.osRepository.listar({
      mecanicoResponsavelId: input.mecanicoId,
      statusIn: STATUS_ATIVOS_MECANICO,
      pagina,
      porPagina,
    });

    return new RespostaPaginadaDto(itens, total, pagina, porPagina);
  }
}
