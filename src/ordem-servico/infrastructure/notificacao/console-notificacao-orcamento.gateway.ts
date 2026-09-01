import { Injectable, Logger } from '@nestjs/common';
import {
  NotificacaoOrcamentoGateway,
  NotificacaoOrcamentoInput,
} from '../../application/portas/notificacao-orcamento.gateway';

/**
 * Implementação inicial de notificação: registra o envio em log estruturado.
 * Em produção pode ser substituída por e-mail/SMS/outbox sem alterar os casos de uso.
 */
@Injectable()
export class ConsoleNotificacaoOrcamentoGateway implements NotificacaoOrcamentoGateway {
  private readonly logger = new Logger(ConsoleNotificacaoOrcamentoGateway.name);

  enviarParaAprovacao(input: NotificacaoOrcamentoInput): Promise<void> {
    this.logger.log(`Orcamento enfileirado localmente | OS #${input.osNumero}`);
    return Promise.resolve();
  }
}
