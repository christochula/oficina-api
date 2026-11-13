import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PapeisGuard } from '../auth/guards/papeis.guard';
import { Papeis } from '../auth/decorators/papeis.decorator';
import { PapelUsuario as Role } from '../usuario/domain/papel-usuario.enum';

/** Compatibility facade; all inventory data and writes belong exclusively to Production/DynamoDB. */
@ApiTags('Estoque distribuído')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PapeisGuard)
@Controller({ path: 'estoque', version: '1' })
export class DistributedInventoryController {
  private async forward(
    path: string,
    authorization: string,
    method = 'GET',
    body?: unknown,
    query: Record<string, string> = {},
  ) {
    const base = process.env.PRODUCTION_SERVICE_URL;
    if (!base)
      throw new BadGatewayException('Configure PRODUCTION_SERVICE_URL');
    const search = new URLSearchParams(
      Object.entries(query).filter(
        ([key, value]) =>
          ['filialId', 'pagina', 'porPagina', 'busca', 'ativo'].includes(key) &&
          typeof value === 'string',
      ),
    );
    let response: Response;
    try {
      response = await fetch(
        `${base.replace(/\/$/, '')}/api/v1/production/inventory${path}${search.size ? `?${search}` : ''}`,
        {
          method,
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(10000),
        },
      );
    } catch {
      throw new BadGatewayException('Production indisponível');
    }
    if (!response.ok) {
      let error: Record<string, unknown> = {
        message: 'Falha ao consultar estoque',
      };
      try {
        error = (await response.json()) as Record<string, unknown>;
      } catch {
        /* HTTP status remains authoritative. */
      }
      throw new HttpException(error, response.status);
    }
    return response.json() as Promise<Record<string, unknown>>;
  }
  @Get()
  @Papeis(Role.ADMINISTRADOR, Role.MECANICO)
  list(
    @Headers('authorization') auth: string,
    @Query() query: Record<string, string>,
  ) {
    return this.forward('', auth, 'GET', undefined, query);
  }
  @Get('pecas/:id')
  @Papeis(Role.ADMINISTRADOR, Role.MECANICO)
  get(
    @Headers('authorization') auth: string,
    @Param('id') id: string,
    @Query() query: Record<string, string>,
  ) {
    return this.forward(
      `/${encodeURIComponent(id)}`,
      auth,
      'GET',
      undefined,
      query,
    );
  }
  @Post('pecas')
  @Papeis(Role.ADMINISTRADOR)
  create(@Headers('authorization') auth: string, @Body() body: unknown) {
    return this.forward('', auth, 'POST', body);
  }
  @Patch('pecas/:id')
  @Papeis(Role.ADMINISTRADOR)
  update(
    @Headers('authorization') auth: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() query: Record<string, string>,
  ) {
    return this.forward(
      `/${encodeURIComponent(id)}`,
      auth,
      'PATCH',
      body,
      query,
    );
  }
  @Patch('pecas/:id/entrada')
  @Papeis(Role.ADMINISTRADOR)
  entry(
    @Headers('authorization') auth: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() query: Record<string, string>,
  ) {
    return this.forward(
      `/${encodeURIComponent(id)}/entrada`,
      auth,
      'PATCH',
      body,
      query,
    );
  }
  @Patch('pecas/:id/ativar')
  @Papeis(Role.ADMINISTRADOR)
  activate(
    @Headers('authorization') auth: string,
    @Param('id') id: string,
    @Query() query: Record<string, string>,
  ) {
    return this.forward(
      `/${encodeURIComponent(id)}/ativar`,
      auth,
      'PATCH',
      undefined,
      query,
    );
  }
  @Patch('pecas/:id/desativar')
  @Papeis(Role.ADMINISTRADOR)
  deactivate(
    @Headers('authorization') auth: string,
    @Param('id') id: string,
    @Query() query: Record<string, string>,
  ) {
    return this.forward(
      `/${encodeURIComponent(id)}/desativar`,
      auth,
      'PATCH',
      undefined,
      query,
    );
  }
}
