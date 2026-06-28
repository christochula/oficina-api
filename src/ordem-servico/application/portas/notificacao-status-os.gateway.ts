import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

export const NOTIFICACAO_STATUS_OS_GATEWAY = 'NOTIFICACAO_STATUS_OS_GATEWAY';

export interface NotificacaoStatusOsInput {
  osId: string;
  osNumero: number;
  clienteId: string;
  emailCliente: string;
  status: StatusOrdemServico;
}

/**
 * Porta de saída da camada application para notificação de atualização de status da OS.
 */
export interface NotificacaoStatusOsGateway {
  enviarAtualizacaoStatus(input: NotificacaoStatusOsInput): Promise<void>;
}
