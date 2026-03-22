import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Interceptor global de padronização do envelope de resposta HTTP.
 *
 * Garante que todas as respostas bem-sucedidas da API sigam um formato consistente:
 * - Respostas simples são envolvidas em `{ data: <resultado> }`.
 * - Respostas paginadas, que já carregam a estrutura `{ data, meta }`, são repassadas
 *   diretamente sem duplo envelope.
 *
 * Este interceptor deve ser registrado globalmente no `main.ts` para assegurar
 * uniformidade em todos os endpoints da aplicação.
 */
@Injectable()
export class RespostaInterceptor implements NestInterceptor {
  /**
   * Intercepta o fluxo de resposta e aplica o envelope padrão.
   *
   * @param _ctx - Contexto de execução (não utilizado — o interceptor é agnóstico ao contexto).
   * @param next - Handler que executa o próximo elemento na cadeia (controller ou outro interceptor).
   * @returns Observable com o resultado envolvido no formato `{ data }` ou `{ data, meta }`.
   */
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((resultado) => {
        // Respostas paginadas já vêm com { data, meta } — repassa direto
        if (resultado && typeof resultado === 'object' && 'data' in resultado && 'meta' in resultado) {
          return resultado;
        }
        return { data: resultado };
      }),
    );
  }
}
