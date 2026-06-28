export const NOTIFICACAO_ORCAMENTO_GATEWAY = 'NOTIFICACAO_ORCAMENTO_GATEWAY';

export interface NotificacaoOrcamentoInput {
  osId: string;
  osNumero: number;
  clienteId: string;
  emailCliente: string;
  valorTotal: number;
}

/**
 * Porta de saída da camada application para notificações de orçamento.
 */
export interface NotificacaoOrcamentoGateway {
  enviarParaAprovacao(input: NotificacaoOrcamentoInput): Promise<void>;
}
