import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Caso de uso responsável por iniciar a execução dos serviços de uma OS.
 * Avança o status da OS de APROVADA para EM_EXECUCAO.
 * A partir deste estado, o mecânico pode registrar consumos de peças do estoque.
 */
@Injectable()
export class IniciarExecucaoUseCase {
  /** @param osRepository - Repositório de ordens de serviço. */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  /**
   * Inicia a execução da OS e persiste a alteração de estado.
   * @param osId - ID da OS a ter a execução iniciada.
   * @param mecanicoId - ID do mecânico responsável que está iniciando a execução.
   * @returns A OS atualizada com status EM_EXECUCAO.
   * @throws RecursoNaoEncontrado se a OS não existir.
   * @throws RegraDeNegocio se a OS não estiver no status APROVADA.
   */
  async executar(osId: string, mecanicoId: string): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Serviço', osId);

    os.iniciarExecucao(mecanicoId);
    await this.osRepository.salvar(os);
    return os;
  }
}
