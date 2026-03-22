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
docker compose up
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

1. `20260320000000_init`
2. `20260321000000_historico_os_status_anterior_novo`
3. `20260322000000_cliente_usuario_vinculo`

A terceira migration adiciona `clientes.usuarioId` e tenta backfill por email para usuarios com papel `CLIENTE` quando o email e univoco entre clientes.

---

## Endpoints Principais

A tabela abaixo resume as rotas mais importantes. O Swagger continua sendo a fonte completa.

| Modulo | Metodo | Rota | Acesso |
|---|---|---|---|
| Auth | POST | `/api/v1/auth/login` | Publico |
| Auth | POST | `/api/v1/auth/refresh` | Refresh token valido |
| Auth | POST | `/api/v1/auth/logout` | Autenticado |
| Usuarios | POST | `/api/v1/usuarios` | Publico |
| Usuarios | GET | `/api/v1/usuarios/:id` | Autenticado |
| Clientes | POST | `/api/v1/clientes` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Clientes | GET | `/api/v1/clientes` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Clientes | GET | `/api/v1/clientes/documento/:numeroDoc` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Clientes | PATCH | `/api/v1/clientes/:id` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Veiculos | POST | `/api/v1/veiculos` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Veiculos | GET | `/api/v1/veiculos` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Veiculos | GET | `/api/v1/veiculos/placa/:placa` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Veiculos | PATCH | `/api/v1/veiculos/:id` | ADMINISTRADOR, CONSULTOR_TECNICO |
| Servicos | POST | `/api/v1/servicos-oficina` | ADMINISTRADOR |
| Servicos | GET | `/api/v1/servicos-oficina` | ADMINISTRADOR, CONSULTOR_TECNICO, MECANICO |
| Servicos | GET | `/api/v1/servicos-oficina/:id` | ADMINISTRADOR, CONSULTOR_TECNICO, MECANICO |
| Servicos | PATCH | `/api/v1/servicos-oficina/:id` | ADMINISTRADOR |
| Estoque | POST | `/api/v1/estoque/pecas` | ADMINISTRADOR |
| Estoque | GET | `/api/v1/estoque` | ADMINISTRADOR, MECANICO |
| Estoque | GET | `/api/v1/estoque/pecas/:pecaId` | ADMINISTRADOR, MECANICO |
| Estoque | PATCH | `/api/v1/estoque/pecas/:pecaId` | ADMINISTRADOR |
| Estoque | PATCH | `/api/v1/estoque/pecas/:pecaId/entrada` | ADMINISTRADOR |
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
| OS | GET | `/api/v1/ordens-servico/mecanico/minhas-ordens` | MECANICO |
| OS | GET | `/api/v1/ordens-servico/mecanico/:id` | MECANICO titular |
| OS | GET | `/api/v1/ordens-servico/minhas/lista` | CLIENTE vinculado |
| OS | GET | `/api/v1/ordens-servico/minhas/:id` | CLIENTE titular |
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

- unit/spec: `43` suites e `266` testes passando
- e2e: `1` smoke suite passando

O e2e versionado continua sendo um smoke test sem PostgreSQL real. O roteiro manual com banco esta documentado em `guia-teste-end-to-end.md`.

---

## Documentacao Complementar

| Documento | Conteudo |
|---|---|
| `guia-teste-end-to-end.md` | estado atual dos testes e roteiro manual |
| `Dicionário Ubíquo v3.md` | linguagem ubiqua do dominio |
| `fluxos-negocio-oficina.md` | fluxos implementados hoje |
| `decisoes-arquiteturais-oficina.md` | decisoes e trade-offs refletidos no codigo |
