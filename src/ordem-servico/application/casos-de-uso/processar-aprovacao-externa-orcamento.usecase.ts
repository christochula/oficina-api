import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

export type DecisaoOrcamentoExterna = 'APROVADO' | 'RECUSADO';

export interface ProcessarAprovacaoExternaOrcamentoInput {
  osId: string;
  decisao: DecisaoOrcamentoExterna;
  origem?: string;
}

/**
 * Processa notificacoes externas de aprovacao/rejeicao de orcamento.
 * Aplica idempotencia minima para chamadas repetidas da mesma decisao.
 */
@Injectable()
export class ProcessarAprovacaoExternaOrcamentoUseCase {
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  async executar(
    input: ProcessarAprovacaoExternaOrcamentoInput,
  ): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(
      OrdemServicoId.de(input.osId),
    );
    if (!os) throw new RecursoNaoEncontrado('Ordem de Servico', input.osId);

    if (
      input.decisao === 'APROVADO' &&
      os.status === StatusOrdemServico.APROVADA
    ) {
      return os;
    }

    if (
      input.decisao === 'RECUSADO' &&
      os.status === StatusOrdemServico.CANCELADA
    ) {
      return os;
    }

    const usuarioSistema = `webhook:${input.origem ?? 'externo'}`;

    if (input.decisao === 'APROVADO') {
      os.aprovarOrcamento(usuarioSistema);
    } else {
      os.rejeitarOrcamento(usuarioSistema);
    }

    await this.osRepository.salvar(os);
    return os;
  }
}
