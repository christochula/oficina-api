import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PapeisGuard } from '../auth/guards/papeis.guard';
import { Papeis } from '../auth/decorators/papeis.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PapelUsuario as Role } from '../usuario/domain/papel-usuario.enum';
import { PrismaService } from '../shared/database/prisma.service';
import { DistributedOrders } from './service';
import { AbrirOrdemServicoDto } from '../ordem-servico/interfaces/http/v1/dtos/abrir-ordem-servico.dto';
import { GerarOrcamentoDto } from '../ordem-servico/interfaces/http/v1/dtos/gerar-orcamento.dto';

@ApiTags('OS distribuída')
@ApiBearerAuth()
@Controller({ path: 'ordens-servico', version: '1' })
@UseGuards(JwtAuthGuard, PapeisGuard)
export class DistributedOrdersController {
  constructor(private readonly service: DistributedOrders) {}
  @Post()
  @Papeis(Role.ADMINISTRADOR, Role.CONSULTOR_TECNICO)
  open(@Body() body: AbrirOrdemServicoDto, @UsuarioAtual() user: JwtPayload) {
    return this.service.open(body, user);
  }
  @Get()
  @Papeis(Role.ADMINISTRADOR, Role.CONSULTOR_TECNICO)
  list(
    @UsuarioAtual() user: JwtPayload,
    @Query() query: Record<string, string>,
  ) {
    return this.service.list(user, query);
  }
  @Get('fila')
  @Papeis(Role.ADMINISTRADOR, Role.CONSULTOR_TECNICO)
  queue(
    @UsuarioAtual() user: JwtPayload,
    @Query() query: Record<string, string>,
  ) {
    return this.service.list(user, query);
  }
  @Get('minhas/lista')
  @Papeis(Role.CLIENTE)
  mine(
    @UsuarioAtual() user: JwtPayload,
    @Query() query: Record<string, string>,
  ) {
    return this.service.list(user, query);
  }
  @Get('mecanico/minhas-ordens')
  @Papeis(Role.MECANICO)
  mechanic(
    @UsuarioAtual() user: JwtPayload,
    @Query() query: Record<string, string>,
  ) {
    return this.service.list(user, query);
  }
  @Get('minhas/:id')
  @Papeis(Role.CLIENTE)
  clientRead(@Param('id') id: string, @UsuarioAtual() user: JwtPayload) {
    return this.service.read(id, user);
  }
  @Get('mecanico/:id')
  @Papeis(Role.MECANICO)
  mechanicRead(@Param('id') id: string, @UsuarioAtual() user: JwtPayload) {
    return this.service.read(id, user);
  }
  @Get(':id')
  @Papeis(Role.ADMINISTRADOR, Role.CONSULTOR_TECNICO)
  read(@Param('id') id: string, @UsuarioAtual() user: JwtPayload) {
    return this.service.read(id, user);
  }
  @Patch(':id/atribuir/:mecanicoId')
  @Papeis(Role.ADMINISTRADOR, Role.CONSULTOR_TECNICO)
  assign(
    @Param('id') id: string,
    @Param('mecanicoId') mecanicoId: string,
    @UsuarioAtual() user: JwtPayload,
    @Headers('authorization') auth: string,
  ) {
    return this.service.forward(id, user, auth, 'production', 'assign', {
      mecanicoId,
    });
  }
  @Patch(':id/diagnostico')
  @Papeis(Role.MECANICO)
  diagnosis(
    @Param('id') id: string,
    @Body() body: { descricao: string },
    @UsuarioAtual() user: JwtPayload,
    @Headers('authorization') auth: string,
  ) {
    return this.service.forward(
      id,
      user,
      auth,
      'production',
      'diagnosis',
      body,
    );
  }
  @Patch(':id/orcamento')
  @Papeis(Role.MECANICO)
  budget(
    @Param('id') id: string,
    @Body() body: GerarOrcamentoDto,
    @UsuarioAtual() user: JwtPayload,
    @Headers('authorization') auth: string,
  ) {
    const items = (body.grupos || []).flatMap((group) =>
      (group.linhas || []).map((line) => ({
        description: line.descricao,
        quantity: line.quantidade,
        unitPriceCents: Math.round(line.valorUnitario * 100),
        ...(line.pecaId ? { pecaId: line.pecaId } : {}),
      })),
    );
    return this.service.forward(
      id,
      user,
      auth,
      'billing',
      'budget',
      { items },
      'PUT',
    );
  }
  @Patch(':id/aprovar')
  @Papeis(Role.CLIENTE)
  approve(
    @Param('id') id: string,
    @UsuarioAtual() user: JwtPayload,
    @Headers('authorization') auth: string,
  ) {
    return this.service.forward(id, user, auth, 'billing', 'approve');
  }
  @Patch(':id/rejeitar')
  @Papeis(Role.CLIENTE)
  reject(
    @Param('id') id: string,
    @UsuarioAtual() user: JwtPayload,
    @Headers('authorization') auth: string,
  ) {
    return this.service.forward(id, user, auth, 'billing', 'reject');
  }
  @Patch(':id/iniciar-execucao')
  @Papeis(Role.MECANICO)
  start(
    @Param('id') id: string,
    @UsuarioAtual() user: JwtPayload,
    @Headers('authorization') auth: string,
  ) {
    return this.service.forward(id, user, auth, 'production', 'start');
  }
  @Patch(':id/consumo-peca')
  @Papeis(Role.MECANICO)
  consume(
    @Param('id') id: string,
    @Body() body: { pecaId: string; quantidade: number },
    @UsuarioAtual() user: JwtPayload,
    @Headers('authorization') auth: string,
  ) {
    return this.service.forward(id, user, auth, 'production', 'consume', body);
  }
  @Patch(':id/finalizar')
  @Papeis(Role.MECANICO)
  complete(
    @Param('id') id: string,
    @UsuarioAtual() user: JwtPayload,
    @Headers('authorization') auth: string,
  ) {
    return this.service.forward(id, user, auth, 'production', 'complete');
  }
  @Post(':id/checkout')
  @Papeis(Role.CLIENTE)
  checkout(
    @Param('id') id: string,
    @UsuarioAtual() user: JwtPayload,
    @Headers('authorization') auth: string,
  ) {
    return this.service.forward(id, user, auth, 'billing', 'checkout');
  }
  @Patch(':id/entregar')
  @Papeis(Role.ADMINISTRADOR, Role.CONSULTOR_TECNICO)
  deliver(@Param('id') id: string, @UsuarioAtual() user: JwtPayload) {
    return this.service.deliver(id, user);
  }
  @Post(':id/saga/retry')
  @Papeis(Role.ADMINISTRADOR, Role.CONSULTOR_TECNICO)
  retry(@Param('id') id: string) {
    return this.service.retry(id);
  }
  @Post(':id/saga/reconcile')
  @Papeis(Role.ADMINISTRADOR)
  reconcile(@Param('id') id: string, @Body() body: { expectedSagaId: string }) {
    return this.service.reconcile(id, body?.expectedSagaId);
  }
}

@Controller({ path: 'internal/auth', version: '1' })
export class ClientLookupController {
  constructor(private readonly db: PrismaService) {}
  @Post('cliente')
  async lookup(
    @Headers('x-internal-token') token: string,
    @Body() body: { cpf: string },
  ) {
    const expected = Buffer.from(process.env.AUTH_CLIENT_LOOKUP_TOKEN || '');
    const received = Buffer.from(token || '');
    if (
      expected.length < 32 ||
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      throw new UnauthorizedException('Acesso negado');
    const cpf = String(body.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) throw new UnauthorizedException('Acesso negado');
    const client = await this.db.cliente.findUnique({
      where: { numeroDoc: cpf },
      select: { id: true, nome: true, email: true, ativo: true },
    });
    if (!client?.ativo) throw new UnauthorizedException('Acesso negado');
    return client;
  }
}
