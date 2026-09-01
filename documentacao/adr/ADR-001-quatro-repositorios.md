# ADR-001 — Separação em quatro repositórios

- Status: aceita
- Data: 2026-08-31

## Contexto

O desafio determina quatro repositórios: função Lambda, infraestrutura Kubernetes, infraestrutura de banco gerenciado e aplicação executada em Kubernetes. Cada um precisa ter README e CI/CD próprios.

## Decisão

Manter:

1. `oficina-auth-serverless`: API Gateway, Lambdas e infraestrutura associada.
2. `oficina-infra-kubernetes`: rede, EKS, ALB/ECR, add-ons e Datadog.
3. `oficina-infra-database`: RDS, Proxy, KMS, segredos, observação e backups.
4. `oficina-api`: domínio NestJS, Prisma, imagem, Helm e documentação compartilhada.

Documentos transversais ficam em `oficina-api/documentacao`; cada raiz mantém somente seu README operacional obrigatório.

## Consequências

- Cada mudança tem ownership, estado Terraform e pipeline delimitados.
- Outputs formam contratos explícitos e exigem ordem de bootstrap.
- Mudanças incompatíveis entre repositórios precisam de rollout coordenado.
- A documentação comum não cria um quinto repositório.

