import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Caso de uso responsável por registrar a entrega do veículo ao cliente.
 * Avança o status da OS de FINALIZADA para ENTREGUE (estado terminal do ciclo de atendimento).
 * Executado pelo CONSULTOR_TECNICO ou ADMINISTRADOR após a conclusão técnica pelo mecânico.
 */
@Injectable()
export class EntregarVeiculoUseCase {
  /** @param osRepository - Repositório de ordens de serviço. */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  /**
   * Registra a entrega do veículo ao cliente e persiste a alteração de estado.
   * @param osId - ID da OS cujo veículo será entregue.
   * @param consultorId - ID do consultor técnico ou administrador que registra a entrega.
   * @returns A OS atualizada com status ENTREGUE.
   * @throws RecursoNaoEncontrado se a OS não existir.
   * @throws RegraDeNegocio se a OS não estiver no status FINALIZADA.
   */
  async executar(osId: string, consultorId: string): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Serviço', osId);

    os.entregarVeiculo(consultorId);
    await this.osRepository.salvar(os);
    return os;
  }
}
