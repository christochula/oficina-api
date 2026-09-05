# ADR-007 — RDS com endpoint público e TLS forçado (Lambda fora de VPC)

- Status: aceita
- Data: 2026-09-03

## Contexto

A Lambda de autenticação por CPF consulta a tabela `clientes` diretamente no
PostgreSQL. O desenho original: RDS privado + RDS Proxy + Lambda em VPC.

No AWS Academy:

- o RDS Proxy exige uma IAM role própria (ADR-005);
- uma Lambda em VPC precisa de NAT ou de VPC endpoints (Secrets Manager, SQS)
  para funcionar — recursos adicionais e frágeis na janela da sessão.

## Decisão

- **RDS sem Proxy**, `publicly_accessible = true`.
- **`rds.force_ssl = 1`** no parameter group (conexão sem TLS é recusada).
- Senha **aleatória de 32 caracteres** (`random_password`), guardada só no
  Secrets Manager.
- Security group libera `5432` de `0.0.0.0/0` (pods do EKS na VPC + Lambda de
  auth fora de VPC). O secret de conexão carrega `ssl_reject_unauthorized:false`
  (TLS sem validar a cadeia, pois não empacotamos a CA do RDS na Lambda).
- As três Lambdas rodam **fora de VPC**; alcançam Secrets Manager, RDS, SQS e
  SNS pela internet.

## Consequências

- O endpoint do RDS é alcançável da internet. Mitigações: TLS obrigatório,
  senha forte aleatória, instância efêmera destruída após a gravação, sem dados
  reais (só massa de demonstração).
- **Em produção real:** RDS privado, RDS Proxy, Lambda em VPC + VPC endpoints,
  SG por referência. O código dos três repositórios de infra no histórico do
  Git já implementava isso.
- Simplifica o `plan` de cada repositório: nenhum depende do estado aplicado de
  outro (todos usam a VPC default via data sources).
