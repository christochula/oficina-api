# Oficina API

Backend do Sistema Integrado de Atendimento e Execução de Serviços para oficina mecânica, desenvolvido como Tech Challenge da Pós-Graduação em Arquitetura de Software — POSTECH.

**Autores:** Karina Lage e Matheus Chula

---

## Visão Geral

API RESTful para gestão completa de uma oficina mecânica: clientes, veículos, ordens de serviço, orçamentos, controle de estoque de peças e autenticação com controle de acesso por papel (RBAC).

---

## Stack Tecnológica

| Tecnologia | Versão | Justificativa |
|---|---|---|
| **NestJS** | v11 | Framework Node.js com injeção de dependências nativa, módulos isolados e suporte a decorators — ideal para arquitetura DDD em camadas |
| **PostgreSQL** | 16 | Banco relacional robusto com suporte a tipos enumerados, transações ACID e constraints de integridade referencial — adequado para o modelo relacional complexo da oficina (OS → cliente, veículo, peças, histórico) |
| **Prisma** | v5 | ORM type-safe com migrations versionadas e mapeamento explícito — mantém os tipos de persistência fora da camada de domínio |
| **JWT** | — | Autenticação stateless com access token (curto prazo) e refresh token (longo prazo, hash armazenado no banco) |
| **Swagger** | — | Documentação interativa gerada automaticamente a partir dos decorators NestJS |
| **Docker** | — | Containerização com build multi-stage e docker-compose para orquestração completa |

---

## Arquitetura

O projeto adota **Domain-Driven Design (DDD)** em monólito em camadas, com cada módulo NestJS correspondendo a um bounded context:

```
src/
├── shared/                  # Kernel compartilhado (IdUnico, exceções, interceptors)
├── auth/                    # Autenticação JWT — access + refresh token
├── usuario/                 # Usuários internos (Admin, Mecânico, Consultor) e externos (Cliente)
├── cliente/                 # Cadastro e gestão de clientes
├── veiculo/                 # Cadastro e gestão de veículos
├── ordem-servico/           # Aggregate central — ciclo completo de atendimento
└── estoque/                 # Controle de peças e quantidades
```

**Camadas dentro de cada módulo:**

| Camada | Responsabilidade |
|---|---|
| `domain/` | Entidades, Value Objects, interfaces de repositório, eventos de domínio |
| `application/casos-de-uso/` | Orquestração dos fluxos de negócio |
| `infrastructure/persistencia/` | Implementações Prisma dos repositórios |
| `interfaces/http/v1/` | Controllers, DTOs, decorators Swagger |

---

## Papéis de Acesso (RBAC)

| Papel | Descrição |
|---|---|
| `ADMINISTRADOR` | Acesso total — usuários, estoque, todas as OS |
| `CONSULTOR_TECNICO` | Abre OS, gera orçamentos, atende clientes |
| `MECANICO` | Executa diagnósticos, registra consumo de peças, finaliza OS |
| `CLIENTE` | Consulta e aprova/rejeita orçamento das próprias OS |

---

## Ciclo de Vida da Ordem de Serviço

```
Recebida → Atribuída → Em Diagnóstico* → Aguardando Aprovação
                                                ↓            ↘
                                             Aprovada      Cancelada
                                                ↓
                                          Em Execução → Finalizada → Entregue
```

*A etapa de diagnóstico é opcional.

---

## Como Executar

### Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop) instalado e em execução

### 1. Clonar o repositório

```bash
git clone <url-do-repositorio>
cd oficina_api
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

> Para uso em desenvolvimento, os valores padrão do `.env.example` já funcionam.
> **Importante:** em produção, substitua os valores de `JWT_SECRET` e `JWT_REFRESH_SECRET` por segredos fortes.

### 3. Subir o ambiente

```bash
docker compose up
```

O comando irá:
1. Construir a imagem da API (build multi-stage)
2. Subir o banco de dados PostgreSQL
3. Aplicar as migrations automaticamente (`prisma migrate deploy`)
4. Iniciar a API na porta configurada (padrão: `3000`)

### 4. Acessar

| Recurso | URL |
|---|---|
| API | `http://localhost:3000/api` |
| Documentação Swagger | `http://localhost:3000/api/docs` |

---

## Executando Localmente (sem Docker)

Para rodar a API fora do container (banco ainda via Docker):

```bash
# 1. Subir apenas o banco
docker compose up db -d

# 2. Instalar dependências
npm install

# 3. Ajustar DATABASE_URL no .env para apontar para localhost
# DATABASE_URL=postgresql://oficina:oficina_senha@localhost:5432/oficina_db

# 4. Aplicar migrations
npx prisma migrate deploy

# 5. Iniciar em modo desenvolvimento
npm run start:dev
```

---

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta da API | `3000` |
| `CORS_ORIGIN` | Origem permitida no CORS | `http://localhost:5173` |
| `DATABASE_URL` | String de conexão PostgreSQL | — |
| `POSTGRES_USER` | Usuário do banco (docker-compose) | `oficina` |
| `POSTGRES_PASSWORD` | Senha do banco (docker-compose) | `oficina_senha` |
| `POSTGRES_DB` | Nome do banco (docker-compose) | `oficina_db` |
| `JWT_SECRET` | Segredo do access token | — |
| `JWT_EXPIRATION` | Expiração do access token | `15m` |
| `JWT_REFRESH_SECRET` | Segredo do refresh token | — |
| `JWT_REFRESH_EXPIRATION` | Expiração do refresh token | `7d` |

---

## Endpoints Principais

A documentação completa e interativa está disponível no Swagger (`/api/docs`).

| Módulo | Método | Rota | Papel mínimo |
|---|---|---|---|
| **Auth** | POST | `/api/v1/auth/login` | Público |
| | POST | `/api/v1/auth/refresh` | Autenticado |
| | POST | `/api/v1/auth/logout` | Autenticado |
| **Usuários** | POST | `/api/v1/usuarios` | ADMINISTRADOR |
| | GET | `/api/v1/usuarios/:id` | ADMINISTRADOR |
| **Clientes** | POST | `/api/v1/clientes` | ADMINISTRADOR, CONSULTOR |
| | GET | `/api/v1/clientes/documento/:numeroDoc` | ADMINISTRADOR, CONSULTOR |
| | PATCH | `/api/v1/clientes/:id` | ADMINISTRADOR, CONSULTOR |
| **Veículos** | POST | `/api/v1/veiculos` | ADMINISTRADOR, CONSULTOR |
| | GET | `/api/v1/veiculos/placa/:placa` | ADMINISTRADOR, CONSULTOR |
| | PATCH | `/api/v1/veiculos/:id` | ADMINISTRADOR, CONSULTOR |
| **Ordens de Serviço** | POST | `/api/v1/ordens-servico` | CONSULTOR |
| | GET | `/api/v1/ordens-servico` | Internos |
| | GET | `/api/v1/ordens-servico/:id` | Internos |
| | GET | `/api/v1/ordens-servico/minhas/lista` | CLIENTE |
| | GET | `/api/v1/ordens-servico/minhas/:id` | CLIENTE |
| | PATCH | `/api/v1/ordens-servico/:id/atribuir` | ADMINISTRADOR |
| | PATCH | `/api/v1/ordens-servico/:id/diagnostico` | MECANICO |
| | PATCH | `/api/v1/ordens-servico/:id/orcamento` | CONSULTOR |
| | PATCH | `/api/v1/ordens-servico/:id/aprovar` | CLIENTE, ADMIN, CONSULTOR |
| | PATCH | `/api/v1/ordens-servico/:id/rejeitar` | CLIENTE, ADMIN, CONSULTOR |
| | PATCH | `/api/v1/ordens-servico/:id/iniciar-execucao` | MECANICO |
| | PATCH | `/api/v1/ordens-servico/:id/consumo-peca` | MECANICO |
| | PATCH | `/api/v1/ordens-servico/:id/finalizar` | MECANICO |
| | PATCH | `/api/v1/ordens-servico/:id/entregar` | CONSULTOR, ADMIN |
| | GET | `/api/v1/ordens-servico/relatorio/lead-time` | ADMINISTRADOR, CONSULTOR |
| **Estoque** | POST | `/api/v1/estoque/pecas` | ADMINISTRADOR |
| | GET | `/api/v1/estoque/pecas` | Internos |
| | GET | `/api/v1/estoque/pecas/:pecaId` | Internos |
| | PATCH | `/api/v1/estoque/pecas/:pecaId/entrada` | ADMINISTRADOR |

---

## Segurança

- **Autenticação JWT** com access token (15 min) e refresh token com rotação (7 dias)
- O hash do refresh token é armazenado no banco — invalidação real no logout
- **RBAC** via `@Papeis()` decorator e `PapeisGuard` — cada endpoint define o papel mínimo
- **ValidationPipe global** com `whitelist: true` e `forbidNonWhitelisted: true` — rejeita campos não declarados nos DTOs
- **CORS** configurável via variável de ambiente
- Mensagem genérica no login (sem enumeração de email)

---

## Testes

```bash
# Testes unitários
npm run test

# Testes com cobertura (threshold mínimo: 80% em statements, branches, functions e lines)
npm run test:cov

# Testes e2e
npm run test:e2e
```

A cobertura atual é de **35 suites / 183 testes**, medida sobre domain, casos de uso e validators (excluindo controllers, repositórios e módulos).

---

## Documentação DDD

Os seguintes documentos de modelagem estão disponíveis na raiz do repositório:

| Documento | Conteúdo |
|---|---|
| `Dicionário Ubíquo v3.md` | Linguagem ubíqua completa: entidades, aggregates, papéis, ciclo de vida |
| `fluxos-negocio-oficina.md` | Fluxos de negócio detalhados, atores e regras |
| `decisoes-arquiteturais-oficina.md` | Decisões de modelagem com justificativas e trade-offs |
