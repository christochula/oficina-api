import {
  Body,
  Controller,
  Param,
  Post,
  Version,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProcessarAprovacaoExternaOrcamentoUseCase } from '../../../application/casos-de-uso/processar-aprovacao-externa-orcamento.usecase';
import { ProcessarStatusEmailDto } from './dtos/processar-status-email.dto';

@ApiTags('Ordens de Serviço - Integracao Externa')
@Controller('ordens-servico')
export class OrdemServicoEmailController {
  constructor(
    private readonly processarAprovacaoExterna: ProcessarAprovacaoExternaOrcamentoUseCase,
  ) {}

  @Post(':id/status/email')
  @Version('1')
  @ApiOperation({ summary: 'Processar atualizacao simulada de status recebida por e-mail' })
  async processar(
    @Param('id') id: string,
    @Body() dto: ProcessarStatusEmailDto,
  ) {
    const decisao = dto.novoStatus === 'APROVADA' ? 'APROVADO' : 'RECUSADO';
    const os = await this.processarAprovacaoExterna.executar({
      osId: id,
      decisao,
      origem: dto.origemMensagem ?? 'email',
    });

    return {
      osId: os.id.valor,
      status: os.status,
      origemMensagem: dto.origemMensagem ?? 'email',
      idMensagemExterna: dto.idMensagemExterna ?? null,
      processadoEm: new Date(),
    };
  }
}