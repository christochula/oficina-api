# Oficina API

Aplicação principal do Tech Challenge 3. Este repositório mantém o backend NestJS, o modelo Prisma, as migrações, a imagem OCI e o chart Helm executado no Amazon EKS. A autenticação de clientes por CPF é emitida pelo repositório `oficina-auth-serverless`; o login de operadores por e-mail e senha permanece disponível.

## Arquitetura deste repositório

```mermaid
flowchart LR
  GW[AWS API Gateway] -->|JWT validado| ALB[ALB interno]
  ALB --> TGB[TargetGroupBinding]
  TGB --> SVC[Service Kubernetes]
  SVC --> API[Pods NestJS]
  API --> RDS[(RDS PostgreSQL / Proxy)]
  API --> DD[Datadog Agent]
  ESO[External Secrets Operator] -->|Secrets Manager| API
  HPA[HPA CPU e memória] --> API
```

O API Gateway e as Lambdas ficam no repositório serverless; VPC, EKS, ALB, Datadog Operator e add-ons ficam na infraestrutura Kubernetes; RDS, Proxy e segredo de conexão ficam na infraestrutura de banco.

## Tecnologias

- Node.js 22, NestJS 11 e TypeScript
- Prisma ORM e PostgreSQL
- JWT/Passport e Swagger/OpenAPI
- Jest e Testcontainers
- Docker/OCI e Helm/Kubernetes
- Datadog APM (`dd-trace`), DogStatsD, logs JSON e Unified Service Tagging
- GitHub Actions com autenticação AWS por OIDC

## Execução local

Requisitos: Node.js 22, npm e Docker.

```bash
cp .env.example .env
docker compose up -d db
npm ci
npx prisma migrate deploy
npm run seed
npm run start:dev
```

A API fica em `http://localhost:3000/api`. Os endpoints de saúde são:

- `GET /api/health/live`: processo disponível.
- `GET /api/health/ready`: processo e PostgreSQL disponíveis.

O valor de `JWT_SECRET` local deve ser igual ao usado pela função serverless para validar tokens de clientes. Nunca envie `.env`, tokens, CPF, connection strings ou chaves Datadog ao Git.

## APIs e coleções

- Swagger local: `http://localhost:3000/api/docs`
- Postman: [`postman/oficina-api.postman_collection.json`](postman/oficina-api.postman_collection.json)
- Contrato da autenticação por CPF: `../oficina-auth-serverless/openapi.yaml`
- Swagger homologação: `https://SUBSTITUIR_HOST_HOMOLOG/api/docs`
- Swagger produção: `https://SUBSTITUIR_HOST_PRODUCAO/api/docs`

Os dois últimos links são marcadores deliberados: devem ser substituídos somente após os endpoints existirem.

## Autenticação

O `JwtStrategy` aceita dois tipos de access token HS256, sempre com `iss=oficina-auth-serverless` e `aud=oficina-api`:

- `token_use=client`: emitido pela Lambda após validar CPF, cliente existente e ativo. O backend consulta novamente o cliente, aplica o papel `CLIENTE` e limita acesso às próprias ordens.
- `token_use=operator`: emitido pelo login legado para administrador, consultor técnico ou mecânico.

Tokens expirados, clientes/usuários inativos e assinatura, issuer ou audience inválidos são rejeitados. CPF não é incluído no JWT nem nos logs.

## Observabilidade Datadog

O processo inicia o tracer antes do Nest (`node --require dd-trace/init`). Todos os logs são JSON e incluem `correlation_id`, `dd.trace_id` e `dd.span_id` quando houver span ativo. O header `X-Correlation-Id` é validado ou criado e devolvido ao chamador.

Métricas DogStatsD emitidas:

| Métrica | Finalidade |
|---|---|
| `oficina.api.request.duration_ms` | Distribuição de latência HTTP |
| `oficina.service_orders.created` | Volume de ordens abertas |
| `oficina.service_orders.status_transition` | Transições por status |
| `oficina.service_orders.status_duration_ms` | Tempo em diagnóstico, execução e finalização |
| `oficina.service_orders.processing_errors` | Falhas no processamento de ordens |
| `oficina.integrations.errors` | Erros de webhook/integrações |

O histórico relacional da ordem persiste `statusAnterior`, `statusNovo` e timestamp. A aplicação calcula a duração ao deixar um status e a envia como distribuição, evitando estimativas com base apenas no estado atual.

## Qualidade

```bash
npm run format:check
npm run lint
npm run test:cov -- --runInBand
npm run test:e2e
npm run build
docker build -t oficina-api:local .
```

A suíte herdada e ampliada contém testes unitários e E2E. O workflow `CI` executa formatação, lint, cobertura, build, E2E e build do container em Pull Requests.

## Deploy automático

| Branch | GitHub Environment | Ambiente |
|---|---|---|
| `homolog` | `homolog` | Homologação |
| `main` | `production` | Produção |

O workflow cria uma imagem imutável com tag igual ao commit, envia ao ECR e executa `helm upgrade --atomic`. O chart materializa segredos pelo External Secrets Operator, executa `prisma migrate deploy`, cria probes HTTP, PDB, HPA de 2 a 10 réplicas e TargetGroupBinding para o ALB privado.

Variáveis obrigatórias nos GitHub Environments:

- `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `EKS_CLUSTER_NAME`
- `ECR_REPOSITORY`, `API_TARGET_GROUP_ARN`
- `DATABASE_SECRET_NAME`, `JWT_SECRET_NAME`
- `APP_URL`, `CORS_ORIGIN`, `DD_SITE`
- `NOTIFICATION_QUEUE_URL`, `APP_IRSA_ROLE_ARN`, `DEPLOY_RUNNER` (runner com acesso de rede ao endpoint privado do EKS)

A role OIDC deve restringir repositório, branch/environment e `aud=sts.amazonaws.com`. Nenhuma access key estática é usada.

## Proteção do repositório

`.github/settings.yml` descreve `main` e `homolog` sem push direto, com Pull Request, uma aprovação e checks `Quality`, `E2E` e `Container`. Aplicar essas regras no GitHub e confirmar o convite do usuário `soat-architecture`; arquivos locais não conseguem comprovar esse estado externo.

## Documentação da entrega

Toda a documentação compartilhada está centralizada em [`documentacao/`](documentacao/): diagramas, RFCs, ADRs, modelo ER, runbooks, matriz de requisitos, roteiro do vídeo e conteúdo-base do PDF final. Os demais repositórios mantêm apenas o `README.md` obrigatório e apontam para esta pasta.

## Licença

MIT. Consulte [LICENSE](LICENSE).

