import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  UnauthorizedException,
  Version,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProcessarAprovacaoExternaOrcamentoUseCase } from '../../../application/casos-de-uso/processar-aprovacao-externa-orcamento.usecase';
import { ProcessarAprovacaoExternaDto } from './dtos/processar-aprovacao-externa.dto';

@ApiTags('Ordens de Serviço - Webhook')
@Controller('ordens-servico/webhook')
export class OrdemServicoWebhookController {
  constructor(
    private readonly processarAprovacaoExterna: ProcessarAprovacaoExternaOrcamentoUseCase,
  ) {}

  @Post('orcamento')
  @Version('1')
  @ApiOperation({ summary: 'Receber aprovacao/rejeicao externa de orcamento' })
  @ApiHeader({
    name: 'x-webhook-token',
    required: true,
    description: 'Token compartilhado para autenticacao do webhook externo',
  })
  async processar(
    @Body() dto: ProcessarAprovacaoExternaDto,
    @Headers('x-webhook-token') webhookToken?: string,
  ) {
    const tokenConfigurado = process.env.ORCAMENTO_WEBHOOK_TOKEN;

    if (!tokenConfigurado) {
      throw new ForbiddenException(
        'Webhook externo nao habilitado no ambiente atual.',
      );
    }

    if (!webhookToken || webhookToken !== tokenConfigurado) {
      throw new UnauthorizedException('Token de webhook invalido.');
    }

    const os = await this.processarAprovacaoExterna.executar(dto);

    return {
      osId: os.id.valor,
      status: os.status,
      decisao: dto.decisao,
      origem: dto.origem ?? 'externo',
      processadoEm: new Date(),
    };
  }
}
