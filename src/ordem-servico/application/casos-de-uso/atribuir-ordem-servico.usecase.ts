import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { UsuarioId } from '../../../usuario/domain/usuario-id.value-object';
import { USUARIO_REPOSITORY } from '../../../usuario/domain/usuario.repository';
import type { UsuarioRepository } from '../../../usuario/domain/usuario.repository';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Caso de uso responsável por atribuir um mecânico responsável a uma OS.
 * Delega a validação de papel do usuário ao aggregate OrdemServico.
 * Avança o status da OS de RECEBIDA para ATRIBUIDA.
 */
@Injectable()
export class AtribuirOrdemServicoUseCase {
  /**
   * @param osRepository - Repositório de ordens de serviço.
   * @param usuarioRepository - Repositório de usuários (para buscar o mecânico).
   */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
  ) {}

  /**
   * Atribui um mecânico à OS e persiste a alteração de estado.
   * @param osId - ID da OS a receber o mecânico.
   * @param mecanicoId - ID do usuário a ser atribuído como mecânico responsável.
   * @returns A OS atualizada com status ATRIBUIDA.
   * @throws RecursoNaoEncontrado se a OS não existir.
   * @throws RecursoNaoEncontrado se o usuário não existir.
   * @throws RegraDeNegocio se o usuário não tiver papel MECANICO.
   * @throws RegraDeNegocio se a OS não estiver no status RECEBIDA.
   */
  async executar(osId: string, mecanicoId: string): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Serviço', osId);

    const mecanico = await this.usuarioRepository.buscarPorId(UsuarioId.de(mecanicoId));
    if (!mecanico) throw new RecursoNaoEncontrado('Usuário', mecanicoId);

    os.atribuirMecanico(mecanico);
    await this.osRepository.salvar(os);
    return os;
  }
}
