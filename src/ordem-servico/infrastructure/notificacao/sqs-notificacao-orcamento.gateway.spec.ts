import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { JsonLoggerService } from '../../../shared/observability/json-logger.service';
import { TelemetryService } from '../../../shared/observability/telemetry.service';
import { SqsNotificacaoOrcamentoGateway } from './sqs-notificacao-orcamento.gateway';

describe('SqsNotificacaoOrcamentoGateway', () => {
  const originalQueueUrl = process.env.NOTIFICATION_QUEUE_URL;
  const send = jest.fn();
  const integrationError = jest.fn();
  const logError = jest.fn();

  function gateway(): SqsNotificacaoOrcamentoGateway {
    return new SqsNotificacaoOrcamentoGateway(
      { send } as unknown as SQSClient,
      { integrationError } as unknown as TelemetryService,
      { error: logError } as unknown as JsonLoggerService,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NOTIFICATION_QUEUE_URL =
      'https://sqs.us-east-1.amazonaws.com/123456789012/oficina';
  });

  afterAll(() => {
    if (originalQueueUrl === undefined) {
      delete process.env.NOTIFICATION_QUEUE_URL;
    } else {
      process.env.NOTIFICATION_QUEUE_URL = originalQueueUrl;
    }
  });

  it('envia payload minimo para a fila sem PII', async () => {
    send.mockResolvedValue({ MessageId: 'message-1' });

    await gateway().enviarParaAprovacao({
      osId: 'os_01',
      osNumero: 123,
      valorTotal: 150.5,
    });

    const command = send.mock.calls[0][0] as SendMessageCommand;
    expect(command.input.QueueUrl).toContain('/oficina');
    expect(command.input.MessageBody).toContain('#123');
    expect(command.input.MessageBody).toContain('150.50');
    expect(command.input.MessageBody).not.toContain('email');
    expect(integrationError).not.toHaveBeenCalled();
  });

  it('emite metrica e erro estruturado quando o SQS falha', async () => {
    send.mockRejectedValue(new Error('network failure'));

    await expect(
      gateway().enviarParaAprovacao({
        osId: 'os_01',
        osNumero: 123,
        valorTotal: 150,
      }),
    ).rejects.toThrow('network failure');

    expect(integrationError).toHaveBeenCalledWith('sqs_notification');
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'notification.enqueue_failed',
        error_type: 'Error',
      }),
      undefined,
      'SqsNotificacaoOrcamentoGateway',
    );
  });

  it('falha rapidamente quando a URL da fila nao esta configurada', async () => {
    delete process.env.NOTIFICATION_QUEUE_URL;

    await expect(
      gateway().enviarParaAprovacao({
        osId: 'os_01',
        osNumero: 123,
        valorTotal: 150,
      }),
    ).rejects.toThrow('Missing NOTIFICATION_QUEUE_URL');

    expect(send).not.toHaveBeenCalled();
    expect(integrationError).toHaveBeenCalledWith('sqs_notification');
  });
});
