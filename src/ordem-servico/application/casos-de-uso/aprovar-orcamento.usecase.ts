import { Inject, Injectable } from '@nestjs/common';
import { BuscarClientePorUsuarioUseCase } from '../../../cliente/application/casos-de-uso/buscar-cliente-por-usuario.usecase';
import { AcessoNegado, RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Caso de uso responsavel por registrar a aprovacao do orcamento de uma OS.
 * Avanca o status da OS de AGUARDANDO_APROVACAO para APROVADA.
 * Apenas o CLIENTE titular da OS pode executar esta acao.
 */
@Injectable()
export class AprovarOrcamentoUseCase {
  /** @param osRepository - Repositorio de ordens de servico. */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
    private readonly buscarClientePorUsuario: BuscarClientePorUsuarioUseCase,
  ) {}

  /**
   * Aprova o orcamento da OS e persiste a alteracao de estado.
   * @param osId - ID da OS cujo orcamento sera aprovado.
   * @param usuarioId - ID do usuario CLIENTE autenticado que esta aprovando.
   * @returns A OS atualizada com status APROVADA e `orcamento.aprovadoEm` preenchido.
   * @throws RecursoNaoEncontrado se a OS nao existir.
   * @throws AcessoNegado se a OS nao pertencer ao cliente autenticado.
   */
  async executar(osId: string, usuarioId: string): Promise<OrdemServico> {
    const cliente = await this.buscarClientePorUsuario.executar(usuarioId);
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Servico', osId);
    if (os.clienteId !== cliente.id.valor) {
      throw new AcessoNegado('Somente o cliente titular da OS pode aprovar este orcamento.');
    }

    os.aprovarOrcamento(usuarioId);
    await this.osRepository.salvar(os);
    return os;
  }
}
