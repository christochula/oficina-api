# RFC-002 — PostgreSQL gerenciado para persistência

- Status: aceita
- Data: 2026-08-31
- Responsáveis: equipe SOAT

## Contexto

Ordens de serviço relacionam cliente, veículo, diagnóstico, orçamento, serviços, peças, estoque e histórico. Essas operações exigem consistência transacional, integridade referencial e consultas por estado e tempo. O código existente já usa Prisma com PostgreSQL.

## Proposta

Usar Amazon RDS for PostgreSQL privado, criptografado e acessado pela aplicação por TLS. As Lambdas usam RDS Proxy para reduzir criação concorrente de conexões. O schema e as migrations continuam versionados no repositório `oficina-api`; o repositório `oficina-infra-database` provisiona somente a plataforma.

Produção habilita Multi-AZ, deletion protection, snapshot final, backup/PITR, Performance Insights, Enhanced Monitoring e exportação de logs. Homologação mantém os mesmos controles lógicos com capacidade e retenção menores.

## Motivos

- Transações ACID preservam orçamento, estoque, status e histórico como uma única unidade lógica.
- Chaves estrangeiras e unicidade representam invariantes do domínio.
- PostgreSQL mantém compatibilidade com o schema Prisma existente.
- RDS transfere patching, backup e failover da equipe para um serviço gerenciado.
- RDS Proxy protege o banco contra tempestades de conexão geradas por Lambda.

## Alternativas consideradas

- DynamoDB: exigiria redesenho de agregados, índices e transações e dificultaria consultas relacionais do domínio.
- MySQL gerenciado: atenderia parte dos requisitos, mas criaria uma migração sem benefício funcional claro.
- PostgreSQL dentro do EKS: rejeitado por transferir alta disponibilidade, volume, backup e restauração para o cluster.

## Segurança e operação

- Instância sem IP público e security group aceitando apenas os SGs explicitamente autorizados.
- Credenciais geradas e mantidas no Secrets Manager; nenhum valor sensível é output público.
- Parâmetro `rds.force_ssl` e Proxy com TLS obrigatório.
- Chave KMS, logs, métricas e alarmes com retenção definida por ambiente.
- Restauração ocorre em nova instância, seguida de validação e troca controlada do endpoint.

## Consequências

- O serviço tem custo fixo e janela de manutenção.
- Alterações de schema dependem de migrations retrocompatíveis antes de rollouts destrutivos.
- O estado Terraform precisa de backend remoto criptografado e acesso restrito, pois referencia recursos sensíveis.

## Critérios de aceite

- `prisma validate` e migrations passam na integração.
- Conexões sem TLS e de SGs não autorizados são recusadas.
- Produção preserva backup, PITR, snapshot final e deletion protection.

