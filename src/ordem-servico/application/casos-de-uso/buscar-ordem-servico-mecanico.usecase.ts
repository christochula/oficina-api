import { Inject, Injectable } from '@nestjs/common';
import {
  AcessoNegado,
  RecursoNaoEncontrado,
} from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Caso de uso responsável por permitir que um MECÂNICO consulte os detalhes
 * de uma OS específica, com validação de que ele é o mecânico responsável.
 *
 * Enforça o isolamento: o mecânico só pode visualizar OS atribuídas a ele.
 * Para acesso irrestrito por usuários internos, use {@link BuscarOrdemServicoPorIdUseCase}.
 */
@Injectable()
export class BuscarOrdemServicoMecanicoUseCase {
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  /**
   * Busca uma OS e valida que o mecânico autenticado é o responsável.
   * @param osId - ID da OS a buscar.
   * @param mecanicoId - ID do mecânico autenticado (extraído do JWT).
   * @returns A OS encontrada, garantindo que o mecânico é o responsável.
   * @throws RecursoNaoEncontrado se a OS não existir.
   * @throws AcessoNegado se o mecânico não for o responsável pela OS.
   */
  async executar(osId: string, mecanicoId: string): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Serviço', osId);
    if (os.mecanicoResponsavelId !== mecanicoId) throw new AcessoNegado();
    return os;
  }
}
