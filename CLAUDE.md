# CLAUDE.md — Contexto do Projeto oficina_api

## Documentação de Referência

| Documento | Conteúdo |
|---|---|
| `Dicionário Ubíquo v3.md` | Linguagem ubíqua completa: entidades, aggregates, papéis, ciclo de vida |
| `fluxos-negocio-oficina.md` | Fluxos de negócio detalhados, atores, regras, casos de uso derivados |
| `decisoes-arquiteturais-oficina.md` | Decisões de modelagem e arquitetura com justificativas e trade-offs |

---

## Visão Geral

Backend de um sistema de gestão de oficina mecânica, desenvolvido como projeto de pós-graduação em Arquitetura de Software (POSTECH). O sistema gerencia clientes, veículos e ordens de serviço de uma oficina.

---

## Stack Tecnológica

- **Framework**: NestJS v11
- **ORM**: Prisma **v5** (v7 tem breaking changes na configuração de datasource — manter em v5)
- **Banco de dados**: PostgreSQL 16
- **Autenticação**: JWT
- **Documentação de API**: Swagger (`@nestjs/swagger`)
- **Infraestrutura local**: Docker + docker-compose
- **Deploy futuro**: AWS (fase posterior)
- **IDs únicos**: ULID com prefixo por entidade (ex: `os`, `cl`, `ve`) via biblioteca `ulid` ou `ulidx` — não usar gerador customizado

---

## Arquitetura

- **Padrão**: DDD (Domain-Driven Design) em monólito em camadas
- **Evolução planejada**: migração para microserviços em fase futura
- **Camadas**:
  - `domain/` — entidades, objetos de valor, interfaces de repositório, eventos de domínio
  - `application/` — casos de uso, serviços de aplicação
  - `infrastructure/` — implementações Prisma, serviços externos
  - `interfaces/` — controllers, DTOs, decorators Swagger

**Regra crítica**: tipos Prisma não devem vazar para a camada de domínio. Manter mapeamento explícito entre modelos de persistência e entidades de domínio.

---

## Linguagem Ubíqua

Todo o código deve usar **português brasileiro** alinhado ao dicionário ubíquo:
- nomes de classes, métodos, variáveis, enums e eventos em português
- referência completa: `Dicionário Ubíquo v3.md`

### Entidades e Aggregates

| Aggregate Root       | Descrição                                         |
|----------------------|---------------------------------------------------|
| `OrdemServico`       | Aggregate central — ciclo completo de atendimento |
| `Cliente`            | Quem solicita o serviço                           |
| `Veiculo`            | Veículo atendido                                  |
| `Estoque`            | Controle de peças e quantidades disponíveis       |
| `Usuario`            | Acesso ao sistema (interno e externo)             |
| `ServicoOficina`     | Catálogo de serviços padrão — gerenciado pelo ADMINISTRADOR |

### Enum PapelUsuario

```typescript
enum PapelUsuario {
  ADMINISTRADOR,
  CONSULTOR_TECNICO,
  MECANICO,
  CLIENTE,
}
```

### Prefixos de ID por entidade

| Entidade       | Prefixo |
|----------------|---------|
| OrdemServico   | `os`    |
| Cliente        | `cl`    |
| Veiculo        | `ve`    |
| Usuario        | `us`    |
| Peca           | `pc`    |
| ServicoOficina | `sv`    |

---

## Decisões de Domínio Relevantes

- **Veiculo não tem vínculo permanente com Cliente** — a relação ocorre apenas através da `OrdemServico`
- **MecanicoResponsavel não é entidade** — é uma referência (`UsuarioId`) dentro de `OrdemServico`. A validação de que só `MECANICO` pode ser atribuído é responsabilidade do aggregate `OrdemServico`
- **ConsumoPeca é evento de domínio** — disparado por `OrdemServico`, processado por `Estoque`
- **Peça é entidade interna do aggregate Estoque**
- **ServicoOficina é catálogo sem preço base** — preço sempre definido pelo mecânico no orçamento
- **ServicoSolicitado referencia o catálogo** — ao abrir a OS, captura snapshot de `nomeServico` para preservar histórico mesmo com renomeação futura do catálogo
- **Orcamento estruturado em GrupoOrcamento[]** — cada grupo tem título livre + LinhaServico[]; o total é a soma dos totais dos grupos
- **notasInternas / notasCliente** — existem em `OrdemServico` e em `Orcamento`; distinção de visibilidade é responsabilidade do front-end

### Ciclo de vida da OrdemServico

```
Recebida → Atribuída → Em Diagnóstico* → Aguardando Aprovação → Aprovada → Em Execução → Finalizada → Entregue
                                                                  ↘ Cancelada (rejeição do orçamento)
```
*Em Diagnóstico é opcional — OS com apenas serviços solicitados avançam direto para Aguardando Aprovação.
Estado Rascunho descartado no MVP (ver decisoes-arquiteturais-oficina.md §4).

---

## Estrutura de Pastas (src/)

```
shared/                         ← Kernel compartilhado
  domain/
    id.value-object.ts          ← IdUnico base com ULID (ulidx)
    entidade-base.ts            ← id, criadoEm, atualizadoEm, equals()
  eventos/evento-dominio.ts     ← interface EventoDominio
  excecoes/dominio.exception.ts ← RecursoNaoEncontrado, RegraDeNegocio, AcessoNegado
                                   (usa NestJS por ora — ver TODO no arquivo)
  database/
    prisma.service.ts           ← PrismaService (global)
    database.module.ts          ← DatabaseModule @Global — importado no AppModule
  http/
    interceptors/resposta.interceptor.ts   ← envelope { data } / { data, meta }
    filtros/excecao-http.filter.ts         ← erro padrão { erro, mensagem, statusCode, caminho, timestamp }
    dtos/paginacao.dto.ts                  ← pagina, porPagina
    dtos/resposta-paginada.dto.ts          ← RespostaPaginadaDto<T> com meta

auth/                           ← JWT access + refresh (parametrizável via .env)
  strategies/  guards/  decorators/
  interfaces/http/v1/dtos/

usuario/ cliente/ veiculo/ ordem-servico/ estoque/ servico-oficina/
  domain/          ← entidades, enums, interfaces de repositório, value objects
  application/casos-de-uso/
  infrastructure/persistencia/
  interfaces/http/v1/dtos/
  *.module.ts
```

## Schema Prisma (prisma/schema.prisma)

Tabelas: `usuarios`, `clientes`, `veiculos`, `ordens_servico`, `problemas_relatados`, `servicos_solicitados`, `diagnosticos`, `orcamentos`, `grupos_orcamento`, `linhas_servico`, `historico_os`, `consumos_peca`, `pecas`, `estoque`, `servicos_oficina`

- IDs das entidades principais: String (ULID com prefixo gerado na camada de domínio)
- IDs de entidades filhas (ProblemaRelatado, GrupoOrcamento, LinhaServico etc.): `@default(cuid())`
- Valores monetários: `Decimal @db.Decimal(10,2)`
- `ordens_servico.numero`: Int `@default(autoincrement())` — referência operacional humana
- `usuarios.refreshTokenHash`: armazena hash do refresh token ativo (nullable)
- `clientes.tipoDoc`: enum `TipoDocumento { CPF, CNPJ }` — distingue pessoa física de jurídica
- `clientes.numeroDoc`: String `@unique` — CPF ou CNPJ, identificador único de negócio do cliente
- `servicos_solicitados.servicoId`: FK para `servicos_oficina` — referência ao catálogo
- `servicos_solicitados.nomeServico`: snapshot do nome do serviço no momento da abertura da OS
- `orcamentos.notasInternas` / `orcamentos.notasCliente`: campos opcionais de notas
- `ordens_servico.notasInternas` / `ordens_servico.notasCliente`: campos opcionais de notas
- `historico_os.statusAnterior` / `historico_os.statusNovo`: enum `StatusOrdemServico?` — transição estruturada (nullable para compatibilidade histórica; `statusAnterior` é null em `ORDEM_ABERTA`)

## Configuração HTTP (main.ts)

- Prefixo global: `/api`
- Versionamento URI: `/api/v1/...`
- Swagger: `/api/docs` com `addBearerAuth()`
- ValidationPipe global com `whitelist: true`, `transform: true`
- CORS configurável via `CORS_ORIGIN` (default `*`)

## Variáveis de Ambiente necessárias

```env
DATABASE_URL=postgresql://...
PORT=3000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRATION=7d
```

## Casos de Uso de ServicoOficina

- `RegistrarServicoOficinaUseCase` — cria novo serviço no catálogo; rota `POST /servicos-oficina` (ADMINISTRADOR)
- `ListarServicosOficinaUseCase` — lista todos os serviços (ativos e inativos); rota `GET /servicos-oficina` (internos)
- `BuscarServicoOficinaPorIdUseCase` — busca por ID; rota `GET /servicos-oficina/:id` (internos)
- `AtualizarServicoOficinaUseCase` — atualiza nome, descrição ou `ativo`; rota `PATCH /servicos-oficina/:id` (ADMINISTRADOR)

## Casos de Uso de OrdemServico

Consultas separadas por ator:
- `BuscarOrdemServicoPorId` + `ListarOrdensServico` — ADMINISTRADOR, CONSULTOR_TECNICO (acesso total)
- `ListarOrdensMecanico` — MECANICO; rota `GET /ordens-servico/mecanico/minhas-ordens` — OS atribuídas a ele nos status ATRIBUIDA, EM_DIAGNOSTICO, AGUARDANDO_APROVACAO, APROVADA, EM_EXECUCAO
- `BuscarOrdemServicoMecanico` — MECANICO; rota `GET /ordens-servico/mecanico/:id` — busca OS por ID validando que ele é o `mecanicoResponsavelId`; retorna 403 se não for
- `BuscarMinhaOrdemServico` + `ListarMinhasOrdensServico` — CLIENTE (apenas suas próprias OS)

`AbrirOrdemServicoUseCase` — valida `servicoId` no catálogo `ServicoOficina` e captura snapshot `nomeServico` para cada serviço solicitado. Aceita também `notasInternas` e `notasCliente` opcionais.

`GerarOrcamentoUseCase` — input: `{ osId, mecanicoId, grupos: GrupoOrcamentoInput[], notasInternas?, notasCliente? }`. Cada grupo tem `titulo` + `linhas[]`. O total é calculado pela soma dos grupos.

## Casos de Uso de Cliente

Todos os endpoints de clientes e veículos são restritos a **ADMINISTRADOR e CONSULTOR_TECNICO**. MECANICO e CLIENTE não têm acesso.

- `CriarClienteUseCase` — valida unicidade por `numeroDoc`; rejeita com 409 se documento duplicado
- `BuscarClientePorNumeroDocUseCase` — busca por CPF ou CNPJ; rota `GET /clientes/documento/:numeroDoc`
- `AtualizarClienteUseCase` — atualiza apenas nome, email, telefone e endereço; `tipoDoc` e `numeroDoc` são imutáveis

## Validação de Documentos

Utilitário interno: `src/shared/utils/documento-validator.ts`
- Baseado no projeto open-source `cnpj-cpf-validator` de Frederico Ferreira (MIT) — embutido por não estar publicado no npm
- Suporta CPF, CNPJ numérico tradicional e **novo CNPJ alfanumérico** (vigente julho/2026)
- Exporta: `isValidCPF`, `isValidCNPJ`, `cleanCPF`, `cleanCNPJ`, `cleanNumbers`, `cleanAlphanumeric`, `formatCPF`, `formatCNPJ`, `isValidDocument`, `formatDocument`
- `@IsValidCpf()` — `src/shared/http/validators/cpf.validator.ts` → usa `isValidCPF()`
- `@IsValidCnpj()` — `src/shared/http/validators/cnpj.validator.ts` → usa `isValidCNPJ()`
- Aplicados condicionalmente no DTO via `@ValidateIf(o => o.tipoDoc === TipoDocumento.CPF/CNPJ)`

## Normalização de Dados

Campos normalizados **antes de persistir** (camada application/use case):
- `numeroDoc` (Cliente): `cleanCPF(doc)` para CPF, `cleanCNPJ(doc)` para CNPJ — remove máscara, preserva letras em CNPJ alfanumérico
- `placa` (Veiculo): `.toUpperCase().replace(/[^A-Z0-9]/g, '')` — uppercase + remove separadores
- Busca aceita entrada formatada ou sem máscara — normaliza antes de consultar
- **O front-end é responsável por aplicar máscaras de exibição**

## Histórico de Transições de Estado (OrdemServico)

Cada transição de estado registra uma entrada em `historico` com:
- `evento`: código `EventoHistoricoOS` (ex: `MECANICO_ATRIBUIDO`)
- `descricao`: formato `"STATUS_A → STATUS_B | detalhe opcional"` (ex: `"RECEBIDA → ATRIBUIDA | Mecânico João atribuído"`)
- `usuarioId`: ID do usuário que executou a ação
- `statusAnterior`: `StatusOrdemServico | null` — status antes da transição (null apenas em `ORDEM_ABERTA`)
- `statusNovo`: `StatusOrdemServico | null` — status resultante da transição
- `criadoEm`: timestamp automático

Eventos sem mudança de status (`PECA_CONSUMIDA`) têm `statusAnterior === statusNovo`. Primeiro evento do ciclo: `ORDEM_ABERTA` registrado em `OrdemServico.abrir()` com `statusAnterior = null`, `statusNovo = RECEBIDA`.

## Relatório de Lead-time

`GET /api/v1/ordens-servico/relatorio/lead-time` — papéis: ADMINISTRADOR, CONSULTOR_TECNICO
- Lead-time = `criadoEm` da OS até o `criadoEm` do evento `VEICULO_ENTREGUE` no histórico
- Retorna: `totalOSEntregues`, `leadTimeMedioHoras`, `leadTimeMinimoHoras`, `leadTimeMaximoHoras`, `ordens[]`
- Use case: `RelatorioLeadTimeUseCase`

## Sistema de KPIs e Tempo de Ciclo

### KPIs Pré-definidos

`GET /api/v1/ordens-servico/relatorio/kpis` — papéis: ADMINISTRADOR, CONSULTOR_TECNICO
- Use case: `KpisOrdemServicoUseCase`
- Calcula KPIs sobre **todas as OS** (não apenas ENTREGUE), agrupados por segmento do ciclo
- Cada KPI retorna `{ mediaHoras, minimoHoras, maximoHoras, totalAmostras }`

| KPI | Evento início | Evento fim | Significado |
|---|---|---|---|
| `esperaAtribuicao` | `ORDEM_ABERTA` | `MECANICO_ATRIBUIDO` | Eficiência da recepção |
| `diagnosticoOrcamento` | `MECANICO_ATRIBUIDO` | `ORCAMENTO_GERADO` | Agilidade técnica inicial |
| `aprovacaoCliente` | `ORCAMENTO_GERADO` | `ORCAMENTO_APROVADO` | Tempo fora do controle da oficina |
| `execucao` | `EXECUCAO_INICIADA` | `ORDEM_FINALIZADA` | Produtividade do mecânico |
| `esperaEntrega` | `ORDEM_FINALIZADA` | `VEICULO_ENTREGUE` | Eficiência de entrega |
| `leadTimeTotal` | `ORDEM_ABERTA` | `VEICULO_ENTREGUE` | Ocupação de "vaga de garagem" |
| `tempoTecnicoLiquido` | — | — | leadTime − esperaAtribuicao − aprovacaoCliente − esperaEntrega |

- `taxaAprovacaoOrcamento`: percentual de orçamentos aprovados sobre o total gerado

### Tempo de Ciclo Personalizado

`GET /api/v1/ordens-servico/relatorio/tempo-ciclo` — papéis: ADMINISTRADOR, CONSULTOR_TECNICO
- Use case: `TempoCicloPersonalizadoUseCase`
- Permite medir o intervalo entre **quaisquer dois eventos** do histórico
- Aceita múltiplos descontos via query string

**Query params:**
- `eventoInicio` (obrigatório) — ex: `MECANICO_ATRIBUIDO`
- `eventoFim` (obrigatório) — ex: `ORDEM_FINALIZADA`
- `descontar` (repetível, opcional) — formato `EVENTO_A:EVENTO_B`

**Exemplo:** tempo do mecânico descontando aprovação do cliente:
```
GET /relatorio/tempo-ciclo?eventoInicio=MECANICO_ATRIBUIDO&eventoFim=ORDEM_FINALIZADA&descontar=ORCAMENTO_GERADO:ORCAMENTO_APROVADO
```

**Retorno por OS:** `duracaoBrutaHoras`, `duracaoLiquidaHoras`, `totalDescontadoHoras`
**Retorno agregado:** `mediaHoras`, `minimoHoras`, `maximoHoras`, `totalAmostras`

**Regra de desconto:** se a OS não possuir os dois eventos de um par de desconto, o desconto é ignorado para aquela OS específica (não invalida a amostra).

### Método de repositório
`buscarTodasComHistorico()` — adicionado a `OrdemServicoRepository` — retorna todas as OS (qualquer status) com historico completo, usado pelos dois use cases de análise.

## Convenções

- Idioma do código: **português brasileiro**
- Idioma de commits e documentação técnica: **português brasileiro**
- Comunicação com Claude: **português brasileiro**
- Envelope de resposta: `{ data }` simples ou `{ data, meta }` para listas paginadas
- Erro padrão: `{ erro, mensagem, statusCode, caminho, timestamp }`
