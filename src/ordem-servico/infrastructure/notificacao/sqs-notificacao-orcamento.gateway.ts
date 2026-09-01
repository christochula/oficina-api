import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Inject, Injectable } from '@nestjs/common';
import { JsonLoggerService } from '../../../shared/observability/json-logger.service';
import { requestContext } from '../../../shared/observability/request-context';
import { TelemetryService } from '../../../shared/observability/telemetry.service';
import {
  NotificacaoOrcamentoGateway,
  NotificacaoOrcamentoInput,
} from '../../application/portas/notificacao-orcamento.gateway';

export const NOTIFICATION_SQS_CLIENT = Symbol('NOTIFICATION_SQS_CLIENT');

@Injectable()
export class SqsNotificacaoOrcamentoGateway implements NotificacaoOrcamentoGateway {
  constructor(
    @Inject(NOTIFICATION_SQS_CLIENT)
    private readonly sqs: SQSClient,
    private readonly telemetry: TelemetryService,
    private readonly logger: JsonLoggerService,
  ) {}

  async enviarParaAprovacao(input: NotificacaoOrcamentoInput): Promise<void> {
    const queueUrl = process.env.NOTIFICATION_QUEUE_URL?.trim();
    if (!queueUrl) {
      this.recordFailure('MissingConfiguration');
      throw new Error('Missing NOTIFICATION_QUEUE_URL');
    }

    const correlationId = requestContext.getStore()?.correlationId;
    try {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({
            subject: `Orcamento da OS #${input.osNumero}`,
            message:
              `O orcamento da ordem de servico #${input.osNumero}, ` +
              `no valor de R$ ${input.valorTotal.toFixed(2)}, esta disponivel para aprovacao.`,
          }),
          ...(correlationId
            ? {
                MessageAttributes: {
                  correlation_id: {
                    DataType: 'String',
                    StringValue: correlationId,
                  },
                },
              }
            : {}),
        }),
      );
    } catch (error) {
      this.recordFailure(error instanceof Error ? error.name : 'UnknownError');
      throw error;
    }
  }

  private recordFailure(errorType: string): void {
    this.telemetry.integrationError('sqs_notification');
    this.logger.error(
      {
        event: 'notification.enqueue_failed',
        outcome: 'failure',
        error_type: errorType,
      },
      undefined,
      SqsNotificacaoOrcamentoGateway.name,
    );
  }
}
