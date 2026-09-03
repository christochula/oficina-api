# ADR-001 — Separação em quatro repositórios

- Status: aceita
- Data: 2026-08-31

## Contexto

O desafio determina quatro repositórios: função Lambda, infraestrutura Kubernetes, infraestrutura de banco gerenciado e aplicação executada em Kubernetes. Cada um precisa ter README e CI/CD próprios.

## Decisão

Manter:

1. `oficina-auth-serverless`: API Gateway, 3 Lambdas (CPF→JWT, authorizer, notification), SQS/SNS.
2. `oficina-infra-kubernetes`: VPC (default), EKS, node group, ECR, metrics-server, Datadog Agent e observabilidade como código.
3. `oficina-infra-database`: RDS PostgreSQL, security group e secret de conexão.
4. `oficina-api`: domínio NestJS, Prisma/migrations, imagem, Helm e documentação compartilhada.

Documentos transversais ficam em `oficina-api/docs`; cada raiz mantém somente seu README obrigatório. Ver ADR-005 a ADR-009 para as adaptações ao AWS Academy.

## Consequências

- Cada mudança tem ownership, estado Terraform e pipeline delimitados.
- Outputs formam contratos explícitos e exigem ordem de bootstrap.
- Mudanças incompatíveis entre repositórios precisam de rollout coordenado.
- A documentação comum não cria um quinto repositório.

