import { Inject, Injectable } from '@nestjs/common';
import { CLIENTE_REPOSITORY, type ClienteRepository } from '../../../cliente/domain/cliente.repository';
import { cleanCNPJ } from '../../../shared/utils/documento-validator';
import { RegraDeNegocio, RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';
import { ORDEM_SERVICO_REPOSITORY, type OrdemServicoRepository } from '../../domain/ordem-servico.repository';

export interface BuscarStatusOrdemServicoPublicoOutput {
  numero: number;
  status: StatusOrdemServico;
  statusDescricao: string;
  atualizadoEm: Date;
  ultimaMovimentacaoEm: Date;
}

const STATUS_DESCRICAO: Record<StatusOrdemServico, string> = {
  [StatusOrdemServico.RECEBIDA]: 'Recebida',
  [StatusOrdemServico.ATRIBUIDA]: 'Recebida',
  [StatusOrdemServico.EM_DIAGNOSTICO]: 'Diagnóstico',
  [StatusOrdemServico.AGUARDANDO_APROVACAO]: 'Aguardando Aprovação',
  [StatusOrdemServico.APROVADA]: 'Aguardando Aprovação',
  [StatusOrdemServico.EM_EXECUCAO]: 'Execução',
  [StatusOrdemServico.FINALIZADA]: 'Finalizada',
  [StatusOrdemServico.ENTREGUE]: 'Entregue',
  [StatusOrdemServico.CANCELADA]: 'Cancelada',
};

/**
 * Consulta pública de status da OS usando número operacional e documento do cliente.
 *
 * Regras:
 * - exige número da OS válido;
 * - exige documento (CPF/CNPJ) válido e normalizado;
 * - só retorna se a OS pertencer ao cliente do documento informado.
 */
@Injectable()
export class BuscarStatusOrdemServicoPublicoUseCase {
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
  ) {}

  async executar(numero: number, numeroDoc: string): Promise<BuscarStatusOrdemServicoPublicoOutput> {
    if (!Number.isInteger(numero) || numero < 0) {
      throw new RegraDeNegocio('Número da OS inválido');
    }

    const documentoNormalizado = cleanCNPJ(numeroDoc);
    const cliente = await this.clienteRepository.buscarPorNumeroDoc(documentoNormalizado);
    const os = await this.osRepository.buscarPorNumero(numero);

    if (!cliente || !os || os.clienteId !== cliente.id.valor) {
      throw new RecursoNaoEncontrado('Ordem de Serviço', String(numero));
    }

    const ultimaMovimentacao =
      os.historico.length > 0
        ? (os.historico[os.historico.length - 1].criadoEm ?? os.atualizadoEm)
        : os.atualizadoEm;

    return {
      numero: os.numero,
      status: os.status,
      statusDescricao: STATUS_DESCRICAO[os.status],
      atualizadoEm: os.atualizadoEm,
      ultimaMovimentacaoEm: ultimaMovimentacao,
    };
  }
}
