# ADR-005 — LabRole e credenciais de sessão em vez de IRSA/OIDC

- Status: aceita
- Data: 2026-09-03

## Contexto

O AWS Academy Learner Lab nega, por policy explícita, `iam:CreateRole`,
`iam:AttachRolePolicy` e `iam:CreateOpenIDConnectProvider`. Toda a arquitetura
"corporativa" original dependia de:

- criação de IAM roles pelos módulos `terraform-aws-modules/eks` e
  `terraform-aws-modules/iam/.../iam-role-for-service-accounts` (IRSA);
- um OIDC provider do GitHub para os workflows assumirem roles de deploy.

## Decisão

1. **Toda IAM role necessária = `LabRole`** (role genérica pré-existente do lab,
   confiável por EKS, EC2, Lambda). Usada como `role_arn` do cluster EKS,
   `node_role_arn` do node group e `role` das três Lambdas.
2. **Acesso administrativo ao cluster** via `aws_eks_access_entry` +
   `AmazonEKSClusterAdminPolicy` para a role `voclabs` do usuário do lab.
3. **Pods que precisam de AWS** (a app publica em SQS) usam as permissões da
   `LabRole` anexada ao node, via instance metadata — sem IRSA.
4. **GitHub Actions** autentica com as **credenciais de sessão** do lab
   (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN`) como
   repository secrets, renovadas a cada sessão (~4 h). Sem OIDC.

## Consequências

- Menor granularidade de permissão (a `LabRole` é ampla). Aceitável no contexto
  acadêmico e efêmero; documentado.
- Os secrets do GitHub precisam ser renovados a cada "Start Lab" (script no
  runbook, seção 0).
- Os três repositórios de infraestrutura do desenho corporativo foram
  simplificados: sem `platform/` (LB Controller, Cluster Autoscaler, ESO,
  EBS CSI IRSA), sem role do RDS Proxy/Enhanced Monitoring, sem
  `DatadogIntegrationRole`.
- Em uma conta AWS real, revert para IRSA + OIDC é direto (os módulos originais
  continuam no histórico do Git).
