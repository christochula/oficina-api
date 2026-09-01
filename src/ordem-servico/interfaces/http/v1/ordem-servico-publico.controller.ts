import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Papeis } from '../../../../auth/decorators/papeis.decorator';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { PapeisGuard } from '../../../../auth/guards/papeis.guard';
import { PapelUsuario } from '../../../../usuario/domain/papel-usuario.enum';
import {
  BuscarStatusOrdemServicoPublicoOutput,
  BuscarStatusOrdemServicoPublicoUseCase,
} from '../../../application/casos-de-uso/buscar-status-ordem-servico-publico.usecase';

/**
 * Endpoints públicos de consulta para clientes sem autenticação.
 */
@ApiTags('Ordens de Serviço - Público')
@UseGuards(JwtAuthGuard, PapeisGuard)
@Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
@Controller('ordens-servico/publico')
export class OrdemServicoPublicoController {
  constructor(
    private readonly buscarStatusPublico: BuscarStatusOrdemServicoPublicoUseCase,
  ) {}

  /**
   * Consulta o status da OS por número operacional e documento (CPF/CNPJ) do cliente.
   */
  @Get('status/:numero/:numeroDoc')
  @Version('1')
  @ApiOperation({ summary: 'Consultar status da OS (público)' })
  async consultarStatus(
    @Param('numero', ParseIntPipe) numero: number,
    @Param('numeroDoc') numeroDoc: string,
  ): Promise<BuscarStatusOrdemServicoPublicoOutput> {
    return this.buscarStatusPublico.executar(numero, numeroDoc);
  }
}
