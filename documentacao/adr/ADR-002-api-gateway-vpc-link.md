# ADR-002 — API Gateway HTTP API com integração privada síncrona

- Status: aceita
- Data: 2026-08-31

## Contexto

A API deve ficar protegida pelo API Gateway, enquanto workloads e banco permanecem privados. O fluxo HTTP precisa preservar semântica e latência compatíveis com o contrato REST existente.

## Decisão

Usar API Gateway HTTP API. `POST /auth/token` integra diretamente à Lambda de autenticação. Rotas privadas usam Lambda authorizer e, após autorização, seguem por VPC Link para o listener do ALB interno, cujo target group IP é associado ao Service Kubernetes por `TargetGroupBinding`.

Para chamadas HTTP normais, a comunicação é síncrona. Notificações são desacopladas em SQS/DLQ/SNS para não ampliar o tempo da requisição.

## Consequências

- Somente o API Gateway é público; ALB, pods e RDS não recebem tráfego da internet.
- API Gateway e ALB precisam preservar `Authorization`, `X-Correlation-Id` e códigos HTTP.
- Timeout do Gateway limita operações longas; o domínio deve mover trabalho demorado para processamento assíncrono.
- O listener ARN e o target group ARN são contratos da infraestrutura Kubernetes.

