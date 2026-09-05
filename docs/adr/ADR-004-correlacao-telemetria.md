# ADR-004 — Correlação de requisições e telemetria estruturada

- Status: aceita
- Data: 2026-08-31

## Contexto

Uma requisição atravessa API Gateway, Lambda authorizer, ALB e NestJS. Sem um identificador estável, a investigação exige busca manual entre várias fontes.

## Decisão

- Aceitar `X-Correlation-Id` somente no formato seguro permitido; caso ausente/inválido, gerar UUID.
- Propagar o cabeçalho e devolvê-lo na resposta.
- Usar `AsyncLocalStorage` no NestJS para disponibilizar o contexto sem alterar todas as assinaturas.
- Registrar uma linha JSON por evento com `timestamp`, `level`, `service`, `env`, `version`, `correlation_id`, `dd.trace_id` e `dd.span_id` quando houver trace.
- Inicializar `dd-trace` antes dos demais módulos e emitir métricas DogStatsD sem PII.

## Consequências

- O identificador correlaciona, mas não autentica nem autoriza a chamada.
- Campos sensíveis e corpos completos não podem entrar nos logs.
- A cardinalidade de tags permanece limitada; `correlation_id` é atributo pesquisável de log, não tag de métrica.
- Serviços intermediários devem preservar o cabeçalho para manter a cadeia completa.

