import { Inject, Injectable } from '@nestjs/common';
import { BuscarClientePorUsuarioUseCase } from '../../../cliente/application/casos-de-uso/buscar-cliente-por-usuario.usecase';
import { RespostaPaginadaDto } from '../../../shared/http/dtos/resposta-paginada.dto';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Dados de entrada para listagem das OS do cliente autenticado.
 */
export interface ListarMinhasOrdensServicoInput {
  /** ID do usuario autenticado (extraido do JWT). */
  usuarioId: string;
  /** Numero da pagina (padrao: 1). */
  pagina?: number;
  /** Quantidade de registros por pagina (padrao: 20). */
  porPagina?: number;
}

/**
 * Caso de uso responsavel por listar as Ordens de Servico do CLIENTE autenticado.
 * O usuario autenticado e resolvido para o aggregate Cliente antes da consulta.
 * Para listagem irrestrita por usuarios internos, use {@link ListarOrdensServicoUseCase}.
 */
@Injectable()
export class ListarMinhasOrdensServicoUseCase {
  /** @param osRepository - Repositorio de ordens de servico. */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
    private readonly buscarClientePorUsuario: BuscarClientePorUsuarioUseCase,
  ) {}

  /**
   * Lista as OS do cliente autenticado de forma paginada.
   * @param input - Usuario autenticado e parametros de paginacao.
   * @returns Resposta paginada com a lista de OS do cliente e metadados de paginacao.
   */
  async executar(
    input: ListarMinhasOrdensServicoInput,
  ): Promise<RespostaPaginadaDto<OrdemServico>> {
    const pagina = input.pagina ?? 1;
    const porPagina = input.porPagina ?? 20;
    const cliente = await this.buscarClientePorUsuario.executar(
      input.usuarioId,
    );

    const { itens, total } = await this.osRepository.listar({
      clienteId: cliente.id.valor,
      pagina,
      porPagina,
    });
    return new RespostaPaginadaDto(itens, total, pagina, porPagina);
  }
}
