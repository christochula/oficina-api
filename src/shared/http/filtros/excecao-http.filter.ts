import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtro global de exceções HTTP.
 *
 * Captura todas as exceções lançadas na aplicação (anotado com `@Catch()` sem tipo específico)
 * e as converte em respostas HTTP padronizadas com o seguinte envelope de erro:
 *
 * ```json
 * {
 *   "erro": "NOT_FOUND",
 *   "mensagem": "Cliente não encontrado",
 *   "statusCode": 404,
 *   "caminho": "/api/v1/clientes/cl01234",
 *   "timestamp": "2026-03-20T12:00:00.000Z"
 * }
 * ```
 *
 * Exceções do NestJS (`HttpException` e subclasses como `NotFoundException`,
 * `ForbiddenException` etc.) são mapeadas para seus respectivos status HTTP.
 * Exceções inesperadas (erros de runtime) resultam em HTTP 500.
 *
 * Deve ser registrado globalmente no `main.ts` para garantir tratamento uniforme
 * de erros em toda a API.
 */
@Catch()
export class ExcecaoHttpFilter implements ExceptionFilter {
  /**
   * Trata a exceção capturada e envia a resposta HTTP padronizada ao cliente.
   *
   * @param excecao - Exceção capturada; pode ser qualquer tipo (`unknown`).
   * @param host - Host de argumentos que fornece acesso ao contexto HTTP (request/response).
   */
  catch(excecao: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const resposta = ctx.getResponse<Response>();
    const requisicao = ctx.getRequest<Request>();

    const status =
      excecao instanceof HttpException
        ? excecao.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const mensagem =
      excecao instanceof HttpException
        ? this.extrairMensagem(excecao)
        : 'Erro interno do servidor';

    resposta.status(status).json({
      erro: HttpStatus[status] ?? 'ERRO',
      mensagem,
      statusCode: status,
      caminho: requisicao.url,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Extrai a mensagem de erro de uma `HttpException` do NestJS.
   *
   * Lida com os diferentes formatos que o corpo da resposta pode assumir:
   * string simples, objeto com campo `message` (string ou array de strings)
   * — este último é gerado pelo `ValidationPipe` quando múltiplas validações falham.
   *
   * @param excecao - A exceção HTTP da qual extrair a mensagem.
   * @returns A mensagem de erro como string simples ou array de strings de validação.
   */
  private extrairMensagem(excecao: HttpException): string | string[] {
    const resposta = excecao.getResponse();
    if (typeof resposta === 'string') return resposta;
    if (typeof resposta === 'object' && resposta !== null) {
      const obj = resposta as Record<string, unknown>;
      if (typeof obj['message'] === 'string') return obj['message'];
      if (Array.isArray(obj['message'])) return obj['message'] as string[];
    }
    return excecao.message;
  }
}
