# ADR-006 — Ingress via Service LoadBalancer em vez de ALB interno + TargetGroupBinding

- Status: aceita
- Data: 2026-09-03

## Contexto

O desenho original expunha a aplicação por um ALB **interno** criado no
Terraform, com `TargetGroupBinding` (do AWS Load Balancer Controller) registrando
os IPs dos pods, e o API Gateway alcançando o listener por VPC Link.

No AWS Academy: o AWS Load Balancer Controller precisa de IRSA (ADR-005), e o
VPC Link + certificado ACM do ALB interno não cabem na sessão.

## Decisão

A aplicação é exposta por um **`Service type: LoadBalancer`**. O cloud-provider
in-tree do EKS provisiona automaticamente um Classic/Network Load Balancer
público, sem controller adicional e sem IRSA. O API Gateway faz `HTTP_PROXY`
para a URL desse LB (ADR-002).

## Consequências

- Zero dependência do AWS Load Balancer Controller e de `TargetGroupBinding`.
- O LB é público. A rota `ANY /api/{proxy+}` continua protegida pelo authorizer
  do API Gateway + revalidação no NestJS; `/api/health/*` e `/api/docs` são
  intencionalmente públicos.
- Em produção real: `Service` `ClusterIP` + ALB interno + VPC Link + ACM,
  restaurando o LB Controller e o `TargetGroupBinding` (código no histórico).
- O health check do LB usa `/api/health/ready` (readiness) — mesmo path do
  Synthetic do Datadog.
