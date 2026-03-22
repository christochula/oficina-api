import { Inject, Injectable } from '@nestjs/common';
import { AcessoNegado, RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Caso de uso responsável por permitir que um CLIENTE busque uma de suas próprias OS.
 * Enforça o isolamento de dados: o cliente só pode visualizar OS vinculadas ao seu ID.
 * Para acesso irrestrito por usuários internos, use {@link BuscarOrdemServicoPorIdUseCase}.
 */
@Injectable()
export class BuscarMinhaOrdemServicoUseCase {
  /** @param osRepository - Repositório de ordens de serviço. */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  /**
   * Busca uma OS e valida que pertence ao cliente autenticado.
   * @param osId - ID da OS a buscar.
   * @param clienteId - ID do cliente autenticado (extraído do JWT).
   * @returns A OS encontrada, garantindo que pertence ao cliente.
   * @throws RecursoNaoEncontrado se a OS não existir.
   * @throws AcessoNegado se a OS não pertencer ao cliente autenticado.
   */
  async executar(osId: string, clienteId: string): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Serviço', osId);
    if (os.clienteId !== clienteId) throw new AcessoNegado();
    return os;
  }
}
