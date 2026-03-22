import { Inject, Injectable } from '@nestjs/common';
import { RespostaPaginadaDto } from '../../../shared/http/dtos/resposta-paginada.dto';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Dados de entrada para listagem das OS de um cliente específico.
 */
export interface ListarMinhasOrdensServicoInput {
  /** ID do cliente autenticado (extraído do JWT). Filtra apenas suas próprias OS. */
  clienteId: string;
  /** Número da página (padrão: 1). */
  pagina?: number;
  /** Quantidade de registros por página (padrão: 20). */
  porPagina?: number;
}

/**
 * Caso de uso responsável por listar as Ordens de Serviço de um CLIENTE específico.
 * O clienteId é usado como filtro mandatório, garantindo que o cliente só veja suas próprias OS.
 * Para listagem irrestrita por usuários internos, use {@link ListarOrdensServicoUseCase}.
 */
@Injectable()
export class ListarMinhasOrdensServicoUseCase {
  /** @param osRepository - Repositório de ordens de serviço. */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  /**
   * Lista as OS do cliente autenticado de forma paginada.
   * @param input - ClienteId e parâmetros de paginação.
   * @returns Resposta paginada com a lista de OS do cliente e metadados de paginação.
   */
  async executar(input: ListarMinhasOrdensServicoInput): Promise<RespostaPaginadaDto<OrdemServico>> {
    const pagina = input.pagina ?? 1;
    const porPagina = input.porPagina ?? 20;

    const { itens, total } = await this.osRepository.listar({
      clienteId: input.clienteId,
      pagina,
      porPagina,
    });
    return new RespostaPaginadaDto(itens, total, pagina, porPagina);
  }
}
