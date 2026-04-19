import { Injectable, Logger } from '@nestjs/common';
import {
  NotificacaoOrcamentoGateway,
  NotificacaoOrcamentoInput,
} from '../../domain/notificacao-orcamento.gateway';

/**
 * Implementação inicial de notificação: registra o envio em log estruturado.
 * Em produção pode ser substituída por e-mail/SMS/outbox sem alterar os casos de uso.
 */
@Injectable()
export class ConsoleNotificacaoOrcamentoGateway implements NotificacaoOrcamentoGateway {
  private readonly logger = new Logger(ConsoleNotificacaoOrcamentoGateway.name);

  async enviarParaAprovacao(input: NotificacaoOrcamentoInput): Promise<void> {
    this.logger.log(
      `Orcamento enviado para aprovacao | OS #${input.osNumero} | cliente=${input.clienteId} | email=${input.emailCliente} | total=${input.valorTotal.toFixed(2)}`,
    );
  }
}
