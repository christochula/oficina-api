import { Inject, Injectable } from '@nestjs/common';
import { ClienteId } from '../../../cliente/domain/cliente-id.value-object';
import { CLIENTE_REPOSITORY, type ClienteRepository } from '../../../cliente/domain/cliente.repository';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import {
  NOTIFICACAO_STATUS_OS_GATEWAY,
  type NotificacaoStatusOsGateway,
} from '../portas/notificacao-status-os.gateway';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Caso de uso responsável por concluir tecnicamente a execução de uma OS.
 * Avança o status da OS de EM_EXECUCAO para FINALIZADA.
 * Após a finalização, a OS aguarda a entrega do veículo ao cliente pelo consultor.
 */
@Injectable()
export class FinalizarOrdemServicoUseCase {
  /** @param osRepository - Repositório de ordens de serviço. */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
    @Inject(NOTIFICACAO_STATUS_OS_GATEWAY)
    private readonly notificacaoStatusGateway: NotificacaoStatusOsGateway,
  ) {}

  /**
   * Finaliza tecnicamente a OS e persiste a alteração de estado.
   * @param osId - ID da OS a ser finalizada.
   * @param mecanicoId - ID do mecânico responsável que está finalizando a OS.
   * @returns A OS atualizada com status FINALIZADA.
   * @throws RecursoNaoEncontrado se a OS não existir.
   * @throws RegraDeNegocio se a OS não estiver no status EM_EXECUCAO.
   */
  async executar(osId: string, mecanicoId: string): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Serviço', osId);

    os.finalizar(mecanicoId);
    await this.osRepository.salvar(os);

    const cliente = await this.clienteRepository.buscarPorId(ClienteId.de(os.clienteId));
    if (cliente?.email) {
      await this.notificacaoStatusGateway.enviarAtualizacaoStatus({
        osId: os.id.valor,
        osNumero: os.numero,
        clienteId: os.clienteId,
        emailCliente: cliente.email,
        status: os.status,
      });
    }

    return os;
  }
}
