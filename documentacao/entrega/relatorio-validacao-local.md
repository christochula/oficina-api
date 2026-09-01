# Relatório de validação local

Data: 31/08/2026.

## Checks concluídos

### `oficina-api`

- Build, lint e TypeScript aprovados, sem erros ou avisos.
- Jest: 62 suítes e 330 testes aprovados.
- Cobertura global: 90,74% de statements e 91,92% de linhas.
- Schema Prisma válido; as duas migrations foram aplicadas em PostgreSQL temporário.
- E2E alinhado ao JWT de cliente emitido pela Lambda: 2 suítes e 6 testes aprovados.

### `oficina-auth-serverless`

- Typecheck, lint e build aprovados.
- Jest: 7 suítes e 28 testes aprovados; cobertura global de 80,22%.
- JWT valida expiração, emissão, identificador, issuer, audience, algoritmo e tipo de token.
- Produção bloqueia integração privada sem hostname TLS; valor vazio não cria `tls_config`.

### Infraestrutura

- YAML, JSON, HCL, delimitadores, UTF-8, whitespace e contratos entre outputs/inputs foram auditados estaticamente.
- Verificados os limites de rede: VPC Link para ALB interno, IRSA restrita à fila, workloads para RDS Proxy e Proxy para RDS.
- `terraform fmt -check`, `init -backend=false` e `validate` passaram nas cinco raízes Terraform com as versões oficiais da CI.
- Os lockfiles foram atualizados com checksums oficiais para Linux e Windows; o repositório de banco recebeu o lockfile que faltava.
- `helm lint` e `helm template` passaram nos charts da aplicação e da plataforma.
- TFLint 0.64.0 passou nas três raízes Kubernetes; Checkov passou com 81 checks e nenhuma falha.

## Validação Docker

- Docker Engine 29.2.1 disponibilizou 16 CPUs e aproximadamente 16 GB de memória.
- E2E com Testcontainers: 2 suítes e 6 testes aprovados em PostgreSQL 16 limpo.
- A imagem `oficina-api:local-test` foi construída no target `production`; `npm ci` e `npm prune` reportaram zero vulnerabilidades.
- O container executou como usuário `node`, UID 1000, aplicou as duas migrations e atingiu estado `healthy`.
- `/api/health/live`, `/api/health/ready` e `/api/docs` retornaram 200; rota protegida sem JWT retornou 401.
- `docker compose config --quiet` passou usando uma cópia temporária de `.env.example`, removida após o teste.
- Os dois containers e a rede temporários foram removidos; o container `oficina_db` preexistente não foi alterado.

## Dependências externas

Dependem ainda de ambiente externo: `terraform plan/apply`, rollout EKS, tráfego e ingestão Datadog reais, monitores, assinatura SNS, URLs públicas, vídeo, PDF exportado, proteção efetiva de branches e convite a `soat-architecture`.

Após a primeira execução do GitHub Actions, confirme os nomes reais dos required checks antes de alinhar os contexts das regras de branch.
