# Oficina API

Backend do sistema de atendimento e execucao de servicos para oficina mecanica, desenvolvido como Tech Challenge da Pos-Graduacao em Arquitetura de Software.

Autores: Karina Lage e Matheus Chula

---

## Visao Geral

API RESTful para gestao de:

- usuarios e autenticacao JWT
- clientes e veiculos
- catalogo de servicos
- estoque de pecas
- ordens de servico, diagnostico, orcamento, execucao e entrega
- relatorios operacionais baseados no historico da OS

Estado atual do repositorio:

- arquitetura em monolito modular com DDD em camadas
- `OrdemServico` como aggregate central
- consumo de pecas com consistencia transacional entre OS e estoque
- ownership de cliente resolvido por vinculacao explicita entre `Usuario` e `Cliente`
- `CLIENTE` autenticado pode consultar e decidir apenas sobre as proprias OS

---

## Stack Tecnologica

| Tecnologia | Versao | Uso no projeto |
|---|---|---|
| NestJS | 11 | framework HTTP, DI, modulos e guards |
| PostgreSQL | 16 | persistencia relacional principal |
| Prisma | 5 | ORM, migrations e client type-safe |
| JWT | - | access token + refresh token |
| Swagger | - | documentacao interativa |
| Docker | - | execucao local e empacotamento |

---

## Arquitetura

Estrutura principal:

```text
src/
|- shared/            # kernel compartilhado, excecoes, http, database
|- auth/              # login, refresh, logout, strategy JWT
|- usuario/           # identidade e controle de acesso
|- cliente/           # aggregate Cliente e vinculacao ao usuario CLIENTE
|- veiculo/           # aggregate Veiculo
|- servico-oficina/   # catalogo de servicos
|- estoque/           # pecas e saldo
`- ordem-servico/     # aggregate central e ciclo operacional
```

Camadas por modulo:

| Camada | Responsabilidade |
|---|---|
| `domain/` | entidades, value objects, enums e contratos |
| `application/` | casos de uso |
| `infrastructure/` | persistencia Prisma |
| `interfaces/` | controllers, DTOs e Swagger |

Decisoes importantes hoje:

- `OrdemServico` concentra diagnostico, orcamento, execucao, historico e consumo de pecas
- `Cliente` e `Usuario` sao aggregates distintos, ligados por `Cliente.usuarioId`
- ownership do papel `CLIENTE` e validado nos use cases, nao apenas por RBAC
- `PrismaTransactionManager` compartilha uma unica transacao entre OS e estoque no consumo de peca

---

## Papeis de Acesso

| Papel | Escopo atual |
|---|---|
| `ADMINISTRADOR` | usuarios, clientes, veiculos, catalogo, estoque, consultas internas, entrega |
| `CONSULTOR_TECNICO` | clientes, veiculos, abertura/atribuicao de OS, consultas internas, relatorios, entrega |
| `MECANICO` | diagnostico, orcamento, execucao, consumo de peca, finalizacao, consulta das proprias OS |
| `CLIENTE` | consulta das proprias OS e aprovacao/rejeicao do proprio orcamento |

Observacao: aprovacao e rejeicao de orcamento sao hoje rotas exclusivas de `CLIENTE`.

---

## Ownership do Cliente

O acesso do cliente autenticado nao depende mais de comparar `usuario.sub` diretamente com `ordemServico.clienteId`.

Modelo atual:

- `Usuario.id` usa prefixo `us`
- `Cliente.id` usa prefixo `cl`
- `Cliente.usuarioId` vincula opcionalmente um usuario autenticavel com papel `CLIENTE`

Comportamento atual:

- `GET /api/v1/ordens-servico/minhas/lista`
- `GET /api/v1/ordens-servico/minhas/:id`
- `PATCH /api/v1/ordens-servico/:id/aprovar`
- `PATCH /api/v1/ordens-servico/:id/rejeitar`

essas rotas resolvem primeiro o `Cliente` associado ao usuario autenticado e depois validam se a OS pertence a esse cliente.

Como formar o vinculo:

- criar um `Usuario` com papel `CLIENTE`
- criar ou atualizar o `Cliente` com o mesmo email
- alternativamente informar `usuarioId` no payload de criacao/atualizacao do cliente

O cadastro de cliente tenta auto-vincular por email quando encontra um `Usuario CLIENTE` com email igual e sem outro cliente associado.

---

## Ciclo de Vida da Ordem de Servico

```text
RECEBIDA
  -> ATRIBUIDA
  -> EM_DIAGNOSTICO (opcional)
  -> AGUARDANDO_APROVACAO
      -> APROVADA
          -> EM_EXECUCAO
          -> FINALIZADA
          -> ENTREGUE
      -> CANCELADA
```

O diagnostico e opcional, mas o endpoint de diagnostico aceita OS em `ATRIBUIDA` e faz a transicao para `EM_DIAGNOSTICO` antes de registrar o texto tecnico.

---

## Como Executar com Docker

### Pre-requisitos

- Docker Desktop

### Passos

```bash
git clone <url-do-repositorio>
cd oficina_api
cp .env.example .env
docker compose up --build -d
```

Se quiser acompanhar logs em primeiro plano, use:

```bash
docker compose up --build
```

Para parar tudo:

```bash
docker compose down
```

O fluxo de container:

1. sobe PostgreSQL
2. aplica `prisma migrate deploy`
3. inicia a API

URLs uteis:

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

---

## Executando Localmente

Neste modo, somente o banco roda no Docker. A API roda na sua maquina com Node.js.

```bash
# subir apenas o banco
docker compose up db -d

# instalar dependencias
npm install

# ajustar DATABASE_URL no .env para localhost

# aplicar migrations e gerar client
npx prisma migrate deploy
npx prisma generate

# subir a API
npm run start:dev
```

Base da API local:

- `http://localhost:3000/api/v1`

---

## Historico de Migrations

Sequencia atual:

1. `20260322000000_init`

Migration consolidada contendo schema completo e indices de performance.

---

## Endpoints Principais

A tabela abaixo resume as rotas mais importantes. O Swagger continua sendo a fonte completa.

| Modulo | Metodo | Rota | Acesso |
|---|---|---|---|
| Auth | POST | `/api/v1/auth/login` | Publico |
| Auth | POST | `/api/v1/auth/refresh` | Refresh token valido |
| Auth | POST | `/api/v1/auth/logout` | Autenticado |
| Usuarios | POST | `/api/v1/usuarios` | ADMINISTRADOR |
| Usuarios | GET | `/api/v1/usuarios/:id` | ADMINISTRADOR |
| Clientes | POST | `/api/v1/clientes` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Clientes | GET | `/api/v1/clientes` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Clientes | GET | `/api/v1/clientes/documento/:numeroDoc` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Clientes | PATCH | `/api/v1/clientes/:id` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Clientes | PATCH | `/api/v1/clientes/:id/desativar` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Clientes | PATCH | `/api/v1/clientes/:id/ativar` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Veiculos | POST | `/api/v1/veiculos` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Veiculos | GET | `/api/v1/veiculos` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Veiculos | GET | `/api/v1/veiculos/placa/:placa` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Veiculos | PATCH | `/api/v1/veiculos/:id` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Veiculos | PATCH | `/api/v1/veiculos/:id/desativar` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Veiculos | PATCH | `/api/v1/veiculos/:id/ativar` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Servicos | POST | `/api/v1/servicos-oficina` | ADMINISTRADOR |
| Servicos | GET | `/api/v1/servicos-oficina` | ADMINISTRADOR, CONSULTOR_TECNICO, MECANICO |
| Servicos | GET | `/api/v1/servicos-oficina/:id` | ADMINISTRADOR, CONSULTOR_TECNICO, MECANICO |
| Servicos | PATCH | `/api/v1/servicos-oficina/:id` | ADMINISTRADOR |
| Servicos | PATCH | `/api/v1/servicos-oficina/:id/desativar` | ADMINISTRADOR |
| Servicos | PATCH | `/api/v1/servicos-oficina/:id/ativar` | ADMINISTRADOR |
| Estoque | POST | `/api/v1/estoque/pecas` | ADMINISTRADOR |
| Estoque | GET | `/api/v1/estoque` | ADMINISTRADOR, MECANICO |
| Estoque | GET | `/api/v1/estoque/pecas/:pecaId` | ADMINISTRADOR, MECANICO |
| Estoque | PATCH | `/api/v1/estoque/pecas/:pecaId` | ADMINISTRADOR |
| Estoque | PATCH | `/api/v1/estoque/pecas/:pecaId/entrada` | ADMINISTRADOR |
| Estoque | PATCH | `/api/v1/estoque/pecas/:pecaId/desativar` | ADMINISTRADOR |
| Estoque | PATCH | `/api/v1/estoque/pecas/:pecaId/ativar` | ADMINISTRADOR |
| OS | POST | `/api/v1/ordens-servico` | ADMINISTRADOR, CONSULTOR_TECNICO |
| OS | GET | `/api/v1/ordens-servico` | ADMINISTRADOR, CONSULTOR_TECNICO |
| OS | GET | `/api/v1/ordens-servico/:id` | ADMINISTRADOR, CONSULTOR_TECNICO |
| OS | PATCH | `/api/v1/ordens-servico/:id/atribuir/:mecanicoId` | ADMINISTRADOR, CONSULTOR_TECNICO |
| OS | PATCH | `/api/v1/ordens-servico/:id/diagnostico` | MECANICO |
| OS | PATCH | `/api/v1/ordens-servico/:id/orcamento` | MECANICO |
| OS | PATCH | `/api/v1/ordens-servico/:id/aprovar` | CLIENTE titular |
| OS | PATCH | `/api/v1/ordens-servico/:id/rejeitar` | CLIENTE titular |
| OS | PATCH | `/api/v1/ordens-servico/:id/iniciar-execucao` | MECANICO |
| OS | PATCH | `/api/v1/ordens-servico/:id/consumo-peca` | MECANICO |
| OS | PATCH | `/api/v1/ordens-servico/:id/finalizar` | MECANICO |
| OS | PATCH | `/api/v1/ordens-servico/:id/entregar` | ADMINISTRADOR, CONSULTOR_TECNICO |
| OS | POST | `/api/v1/ordens-servico/webhook/orcamento` | Integracao externa via token |
| OS | GET | `/api/v1/ordens-servico/mecanico/minhas-ordens` | MECANICO |
| OS | GET | `/api/v1/ordens-servico/mecanico/:id` | MECANICO titular |
| OS | GET | `/api/v1/ordens-servico/minhas/lista` | CLIENTE vinculado |
| OS | GET | `/api/v1/ordens-servico/minhas/:id` | CLIENTE titular |
| OS | GET | `/api/v1/ordens-servico/publico/status/:numero/:numeroDoc` | Publico |
| OS | GET | `/api/v1/ordens-servico/relatorio/lead-time` | ADMINISTRADOR, CONSULTOR_TECNICO |
| OS | GET | `/api/v1/ordens-servico/relatorio/kpis` | ADMINISTRADOR, CONSULTOR_TECNICO |
| OS | GET | `/api/v1/ordens-servico/relatorio/tempo-ciclo` | ADMINISTRADOR, CONSULTOR_TECNICO |

---

## Seguranca

- access token e refresh token com rotacao
- `refreshTokenHash` persistido no banco
- usuario inativo nao consegue:
  - fazer login
  - renovar sessao
  - autenticar requisicoes protegidas
- RBAC via `@Papeis()` e `PapeisGuard`
- ownership de cliente validado nos use cases usando `Cliente.usuarioId`
- `ValidationPipe` global com `whitelist` e `forbidNonWhitelisted`

---

## Testes

Comandos principais:

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Estado verificado mais recente:

- unit/spec: `56` suites e `291` testes passando
- e2e: `2` suites versionadas (`app.e2e-spec.ts` + `ordem-servico-fluxo.e2e-spec.ts`)

### Roteiro de avaliacao (professores)

1. Preparar ambiente:

```bash
cp .env.example .env
```

2. Subir ambiente completo com Docker:

```bash
docker compose up --build -d
```

3. Confirmar que os containers estao saudaveis:

```bash
docker compose ps
```

4. No host (fora do container), instalar dependencias:

```bash
npm ci
```

5. No host, apontar DATABASE_URL para o banco exposto no localhost:

```bash
export DATABASE_URL=postgresql://oficina:oficina_senha@localhost:5432/oficina_db
```

6. Executar seed do primeiro administrador:

```bash
npm run seed
```

7. Executar build e testes unitarios/integracao de modulo:

```bash
npm run build
npm test -- --runInBand
```

8. Executar cobertura:

```bash
npm run test:cov -- --runInBand
```

9. Executar e2e:

```bash
npm run test:e2e -- --runInBand
```

Observacoes para avaliacao:

- os comandos de teste nao devem ser executados com docker compose exec api, porque o container da API roda imagem de producao (sem arquivos src/test)
- o comando e2e executa tanto o smoke quanto o fluxo completo de OS
- o fluxo completo usa PostgreSQL real e exige o servico db ativo no Docker Compose
- credenciais do admin seed: admin@oficina.com / Admin@123 (ou ADMIN_SEED_PASSWORD)

O roteiro manual complementar continua documentado em `guia-teste-end-to-end.md`.

Fluxo de orçamento: ao gerar orçamento, o sistema registra envio para aprovação via gateway de notificação (implementação inicial em log estruturado, pronta para trocar por e-mail/outbox).

---

## Kubernetes

Manifestos versionados em `k8s/`:

- `namespace.yaml`
- `configmap.yaml`
- `secret.yaml`
- `deployment.yaml`
- `service.yaml`
- `hpa.yaml`
- `kustomization.yaml`

Aplicar no cluster:

```bash
kubectl apply -k k8s
```

Antes do apply, ajuste os valores de segredo em `k8s/secret.yaml`, principalmente:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `ORCAMENTO_WEBHOOK_TOKEN`

---

## Infraestrutura como Codigo (Terraform)

Scripts em `infra/` para provisionar na AWS:

- VPC com sub-redes publicas/privadas
- EKS (cluster Kubernetes)
- RDS PostgreSQL

Passo a passo resumido:

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform validate
terraform plan
terraform apply
```

Detalhes de variaveis e recursos: `infra/README.md`.

---

## CI/CD

Workflows em `.github/workflows/`:

- `ci.yml`: install, build e testes automatizados em push/PR.
- `cd.yml`: build e push de imagem Docker, apply do Terraform (quando secrets AWS existem) e deploy no Kubernetes (quando kubeconfig foi configurado).

Secrets esperados no repositório para CD:

- `AWS_ROLE_ARN`
- `AWS_REGION`
- `DB_PASSWORD`
- `KUBE_CONFIG_DATA` (kubeconfig em base64)

---

## Documentacao Complementar

| Documento | Conteudo |
|---|---|
| `guia-teste-end-to-end.md` | estado atual dos testes e roteiro manual |
| `dicionario-ubiquo.md` | linguagem ubiqua do dominio |
| `fluxos-negocio-oficina.md` | fluxos implementados hoje |
| `decisoes-arquiteturais-oficina.md` | decisoes e trade-offs refletidos no codigo |
