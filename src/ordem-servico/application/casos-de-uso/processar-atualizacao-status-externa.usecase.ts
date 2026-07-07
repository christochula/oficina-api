import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado, RegraDeNegocio } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

export type StatusExternoOS =
  | 'RECEBIDA'
  | 'DIAGNOSTICO'
  | 'EM_DIAGNOSTICO'
  | 'AGUARDANDO_APROVACAO'
  | 'EXECUCAO'
  | 'EM_EXECUCAO'
  | 'FINALIZADA'
  | 'ENTREGUE'
  | 'APROVADA'
  | 'CANCELADA';

export interface ProcessarAtualizacaoStatusExternaInput {
  osId: string;
  novoStatus: StatusExternoOS;
  origem?: string;
  idMensagemExterna?: string;
}

const STATUS_NORMALIZADO: Record<StatusExternoOS, StatusOrdemServico> = {
  RECEBIDA: StatusOrdemServico.RECEBIDA,
  DIAGNOSTICO: StatusOrdemServico.EM_DIAGNOSTICO,
  EM_DIAGNOSTICO: StatusOrdemServico.EM_DIAGNOSTICO,
  AGUARDANDO_APROVACAO: StatusOrdemServico.AGUARDANDO_APROVACAO,
  EXECUCAO: StatusOrdemServico.EM_EXECUCAO,
  EM_EXECUCAO: StatusOrdemServico.EM_EXECUCAO,
  FINALIZADA: StatusOrdemServico.FINALIZADA,
  ENTREGUE: StatusOrdemServico.ENTREGUE,
  APROVADA: StatusOrdemServico.APROVADA,
  CANCELADA: StatusOrdemServico.CANCELADA,
};

/**
 * Processa atualizacoes de status vindas de ferramenta externa, como um parser de e-mail.
 *
 * Diferente do webhook de aprovacao de orcamento, este caso de uso cobre a
 * sincronizacao operacional de status da OS exigida na fase 2.
 */
@Injectable()
export class ProcessarAtualizacaoStatusExternaUseCase {
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  async executar(input: ProcessarAtualizacaoStatusExternaInput): Promise<OrdemServico> {
    const os = await this.osRepository.buscarPorId(OrdemServicoId.de(input.osId));
    if (!os) throw new RecursoNaoEncontrado('Ordem de Servico', input.osId);

    const novoStatus = STATUS_NORMALIZADO[input.novoStatus];
    if (!novoStatus) {
      throw new RegraDeNegocio(`Status externo '${input.novoStatus}' nao reconhecido`);
    }

    const origem = input.origem ?? 'email';
    const usuarioSistema = `externo:${origem}`;
    const statusAnterior = os.status;

    if (novoStatus === StatusOrdemServico.APROVADA) {
      if (os.status === StatusOrdemServico.APROVADA) return os;
      os.aprovarOrcamento(usuarioSistema);
    } else if (novoStatus === StatusOrdemServico.CANCELADA) {
      if (os.status === StatusOrdemServico.CANCELADA) return os;
      os.rejeitarOrcamento(usuarioSistema);
    } else {
      os.atualizarStatusPorIntegracaoExterna(novoStatus, origem, input.idMensagemExterna);
    }

    if (statusAnterior === os.status) {
      return os;
    }

    await this.osRepository.salvar(os);
    return os;
  }
}
