import {
  Body,
  Controller,
  Param,
  Post,
  Version,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProcessarAtualizacaoStatusExternaUseCase } from '../../../application/casos-de-uso/processar-atualizacao-status-externa.usecase';
import { ProcessarStatusEmailDto } from './dtos/processar-status-email.dto';

@ApiTags('Ordens de Serviço - Integracao Externa')
@Controller('ordens-servico')
export class OrdemServicoEmailController {
  constructor(
    private readonly processarAtualizacaoStatusExterna: ProcessarAtualizacaoStatusExternaUseCase,
  ) {}

  @Post(':id/status/email')
  @Version('1')
  @ApiOperation({ summary: 'Processar atualizacao simulada de status recebida por e-mail' })
  async processar(
    @Param('id') id: string,
    @Body() dto: ProcessarStatusEmailDto,
  ) {
    const os = await this.processarAtualizacaoStatusExterna.executar({
      osId: id,
      novoStatus: dto.novoStatus,
      origem: dto.origemMensagem ?? 'email',
      idMensagemExterna: dto.idMensagemExterna,
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
