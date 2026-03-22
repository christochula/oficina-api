import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Caso de uso responsável por buscar uma Ordem de Serviço pelo seu ID.
 * Destinado a usuários internos (ADMINISTRADOR, CONSULTOR_TECNICO, MECANICO)
 * com acesso irrestrito a qualquer OS do sistema.
 * Para acesso do cliente à sua própria OS, use {@link BuscarMinhaOrdemServicoUseCase}.
 */
@Injectable()
export class BuscarOrdemServicoPorIdUseCase {
  /** @param osRepository - Repositório de ordens de serviço. */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  /**
   * Busca uma OS pelo ID informado.
   * @param id - ID da OS a buscar.
   * @returns A OS encontrada com todos os dados.
   * @throws RecursoNaoEncontrado se a OS não existir.
   */
  async executar(id: string): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(id));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Serviço', id);
    return os;
  }
}
