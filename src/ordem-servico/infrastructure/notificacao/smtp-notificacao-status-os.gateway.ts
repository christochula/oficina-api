import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import {
  NotificacaoStatusOsGateway,
  NotificacaoStatusOsInput,
} from '../../application/portas/notificacao-status-os.gateway';

@Injectable()
export class SmtpNotificacaoStatusOsGateway implements NotificacaoStatusOsGateway {
  private readonly logger = new Logger(SmtpNotificacaoStatusOsGateway.name);

  private transporter: Transporter | null = null;

  async enviarAtualizacaoStatus(input: NotificacaoStatusOsInput): Promise<void> {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM ?? user;

    if (!host || !user || !pass || !from) {
      this.logger.warn(
        `SMTP nao configurado. Notificacao de status nao enviada para ${input.emailCliente} (OS #${input.osNumero}, status=${input.status}).`,
      );
      return;
    }

    try {
      if (!this.transporter) {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
        });
      }

      await this.transporter.sendMail({
        from,
        to: input.emailCliente,
        subject: `Atualizacao da OS #${input.osNumero}: ${input.status}`,
        text: [
          'Sua ordem de servico foi atualizada.',
          `OS: ${input.osNumero}`,
          `Status atual: ${input.status}`,
          `Cliente: ${input.clienteId}`,
        ].join('\n'),
      });
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Falha ao enviar email de atualizacao de status da OS #${input.osNumero} para ${input.emailCliente}: ${mensagem}`,
      );
    }
  }
}
