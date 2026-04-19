import { Controller, Get, Param, ParseIntPipe, Version } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BuscarStatusOrdemServicoPublicoOutput,
  BuscarStatusOrdemServicoPublicoUseCase,
} from '../../../application/casos-de-uso/buscar-status-ordem-servico-publico.usecase';

/**
 * Endpoints públicos de consulta para clientes sem autenticação.
 */
@ApiTags('Ordens de Serviço - Público')
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
