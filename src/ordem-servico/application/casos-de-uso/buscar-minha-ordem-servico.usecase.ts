import { Inject, Injectable } from '@nestjs/common';
import { BuscarClientePorUsuarioUseCase } from '../../../cliente/application/casos-de-uso/buscar-cliente-por-usuario.usecase';
import { AcessoNegado, RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Caso de uso responsavel por permitir que um CLIENTE busque uma de suas proprias OS.
 * Enforca o isolamento de dados: o cliente so pode visualizar OS vinculadas ao seu cadastro.
 * Para acesso irrestrito por usuarios internos, use {@link BuscarOrdemServicoPorIdUseCase}.
 */
@Injectable()
export class BuscarMinhaOrdemServicoUseCase {
  /** @param osRepository - Repositorio de ordens de servico. */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
    private readonly buscarClientePorUsuario: BuscarClientePorUsuarioUseCase,
  ) {}

  /**
   * Busca uma OS e valida que pertence ao cliente autenticado.
   * @param osId - ID da OS a buscar.
   * @param usuarioId - ID do usuario autenticado (extraido do JWT).
   * @returns A OS encontrada, garantindo que pertence ao cliente.
   * @throws RecursoNaoEncontrado se a OS nao existir.
   * @throws AcessoNegado se a OS nao pertencer ao cliente autenticado.
   */
  async executar(osId: string, usuarioId: string): Promise<OrdemServico> {
    const cliente = await this.buscarClientePorUsuario.executar(usuarioId);
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Servico', osId);
    if (os.clienteId !== cliente.id.valor) throw new AcessoNegado();
    return os;
  }
}
