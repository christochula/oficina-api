# ADR-002 — API Gateway HTTP API com integração HTTP_PROXY

- Status: aceita (revisada para AWS Academy em 2026-09-03)
- Substitui: a versão anterior baseada em VPC Link + ALB interno

## Contexto

A API deve ficar atrás do API Gateway. O ambiente de execução e gravação é o
**AWS Academy Learner Lab**, que não permite criar VPC Link com segurança
dentro da janela de sessão nem certificados ACM para um ALB interno.

## Decisão

API Gateway **HTTP API** com duas integrações:

- `POST /auth/token` → integração `AWS_PROXY` para a Lambda de autenticação.
- `ANY /api/{proxy+}` → Lambda authorizer (JWT) e, após autorização, integração
  `HTTP_PROXY` (`connection_type = INTERNET`) para a **URL pública do
  `Service type: LoadBalancer`** do EKS. Rotas de probe, Swagger e
  login/refresh de operador ficam públicas sem authorizer.

O authorizer injeta headers internos `x-auth-*`; o NestJS revalida o Bearer JWT
e a identidade ativa. Notificações continuam desacopladas em SQS → Lambda → SNS.

## Consequências

- O ponto de entrada continua sendo o API Gateway; o proxy protegido continua
  exigindo JWT válido.
- O ELB do EKS fica publicamente acessível (a app o expõe). Aceitável para o
  lab; em produção real usaríamos VPC Link + ALB interno + ACM — ver ADR-006.
- O `backend_url` é um contrato: sai do deploy do `oficina-api` e entra como
  GitHub Variable no `oficina-auth-serverless`, que reaplica o API Gateway.
- Timeout do Gateway (30 s) limita operações longas.
