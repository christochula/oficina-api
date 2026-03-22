import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Caso de uso responsável por registrar a aprovação do orçamento de uma OS.
 * Avança o status da OS de AGUARDANDO_APROVACAO para APROVADA.
 * Pode ser executado por CLIENTE, CONSULTOR_TECNICO ou ADMINISTRADOR.
 */
@Injectable()
export class AprovarOrcamentoUseCase {
  /** @param osRepository - Repositório de ordens de serviço. */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  /**
   * Aprova o orçamento da OS e persiste a alteração de estado.
   * @param osId - ID da OS cujo orçamento será aprovado.
   * @param usuarioId - ID do usuário (cliente ou interno) que está aprovando.
   * @returns A OS atualizada com status APROVADA e `orcamento.aprovadoEm` preenchido.
   * @throws RecursoNaoEncontrado se a OS não existir.
   * @throws RegraDeNegocio se a OS não estiver no status AGUARDANDO_APROVACAO.
   * @throws RegraDeNegocio se não houver orçamento associado à OS.
   */
  async executar(osId: string, usuarioId: string): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Serviço', osId);

    os.aprovarOrcamento(usuarioId);
    await this.osRepository.salvar(os);
    return os;
  }
}
