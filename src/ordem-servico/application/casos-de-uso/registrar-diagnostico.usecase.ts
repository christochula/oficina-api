import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Caso de uso responsável por registrar o diagnóstico técnico em uma OS.
 * Requer que a OS esteja no status EM_DIAGNOSTICO.
 * O diagnóstico descreve o resultado da inspeção técnica realizada pelo mecânico.
 */
@Injectable()
export class RegistrarDiagnosticoUseCase {
  /** @param osRepository - Repositório de ordens de serviço. */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  /**
   * Registra o diagnóstico técnico na OS e persiste a alteração.
   * @param osId - ID da OS a receber o diagnóstico.
   * @param descricao - Texto descritivo do diagnóstico técnico realizado.
   * @param mecanicoId - ID do mecânico que realizou o diagnóstico.
   * @returns A OS atualizada com o diagnóstico registrado.
   * @throws RecursoNaoEncontrado se a OS não existir.
   * @throws RegraDeNegocio se a OS não estiver no status EM_DIAGNOSTICO.
   */
  async executar(osId: string, descricao: string, mecanicoId: string): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Serviço', osId);

    if (os.status === StatusOrdemServico.ATRIBUIDA) {
      os.iniciarDiagnostico(mecanicoId);
    }
    os.registrarDiagnostico(descricao, mecanicoId);
    await this.osRepository.salvar(os);
    return os;
  }
}
