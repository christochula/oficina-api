import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Papeis } from '../../../../auth/decorators/papeis.decorator';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { PapeisGuard } from '../../../../auth/guards/papeis.guard';
import { PapelUsuario } from '../../../../usuario/domain/papel-usuario.enum';
import { ProcessarAtualizacaoStatusExternaUseCase } from '../../../application/casos-de-uso/processar-atualizacao-status-externa.usecase';
import { ProcessarStatusEmailDto } from './dtos/processar-status-email.dto';

@ApiTags('Ordens de Serviço - Integracao Externa')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PapeisGuard)
@Controller('ordens-servico')
export class OrdemServicoEmailController {
  constructor(
    private readonly processarAtualizacaoStatusExterna: ProcessarAtualizacaoStatusExternaUseCase,
  ) {}

  @Post(':id/status/email')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
  @ApiOperation({
    summary: 'Processar atualizacao simulada de status recebida por e-mail',
  })
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
