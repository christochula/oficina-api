# CLAUDE.md - Contexto do Projeto oficina_api

## Documentacao de referencia

| Documento | Foco |
|---|---|
| `dicionario-ubiquo.md` | Linguagem ubiqua, aggregates, papeis e termos do dominio |
| `fluxos-negocio-oficina.md` | Fluxos operacionais e regras de negocio do sistema |
| `decisoes-arquiteturais-oficina.md` | Decisoes de modelagem, transacoes, migracoes e trade-offs |
| `guia-teste-end-to-end.md` | Estado atual dos testes automatizados e roteiro manual |

---

## Visao geral

Backend de gestao de oficina mecanica construido com NestJS 11, Prisma 5 e PostgreSQL 16.

O repositorio esta organizado como um monolito modular em camadas, com `OrdemServico` como aggregate central e os modulos:

- `auth`
- `usuario`
- `cliente`
- `veiculo`
- `servico-oficina`
- `estoque`
- `ordem-servico`
- `shared`

---

## Stack atual

- Framework: NestJS 11
- ORM: Prisma 5
- Banco: PostgreSQL 16
- Autenticacao: JWT access + refresh token
- Documentacao HTTP: Swagger em `/api/docs`
- Build e runtime local: Node.js + Docker Compose
- IDs publicos: ULID com prefixo por entidade, gerados na camada de dominio com `ulidx`

---

## Arquitetura atual

- Estilo: monolito modular em camadas
- Camada `domain`: entidades, enums, value objects, contratos de repositorio, eventos
- Camada `application`: casos de uso
- Camada `infrastructure`: Prisma e persistencia
- Camada `interfaces`: controllers HTTP v1 e DTOs

### Modulo compartilhado

`src/shared` concentra:

- `domain/`: `EntidadeBase` e `IdUnico`
- `database/`: `PrismaService`, `DatabaseModule`, `DatabaseTransactionManager`, `PrismaTransactionManager`
- `http/`: `RespostaInterceptor`, `ExcecaoHttpFilter`, DTOs de paginacao e validadores
- `utils/`: normalizacao e validacao de documentos

### Contrato HTTP global

Configurado em `src/main.ts`:

- prefixo global `/api`
- versionamento por URI em `/api/v1`
- `ValidationPipe` com `whitelist: true`, `forbidNonWhitelisted: true` e `transform: true`
- `RespostaInterceptor` para respostas `{ data }` ou `{ data, meta }`
- `ExcecaoHttpFilter` para erros padronizados
- Swagger em `/api/docs`

### Transacoes de banco

O estado atual do repositorio possui uma fronteira transacional explicita para fluxos cross-aggregate.

- `DatabaseTransactionManager` define o contrato de unidade transacional
- `PrismaTransactionManager` usa `AsyncLocalStorage` para propagar o `TransactionClient`
- `RegistrarConsumoPecaUseCase` executa baixa no estoque e persistencia da OS na mesma transacao
- `PrismaOrdemServicoRepository` e `PrismaEstoqueRepository` aderem ao mesmo client transacional quando o contexto esta ativo

Isso substitui o comportamento anterior em que o estoque podia ser confirmado antes da OS.

### Migracoes Prisma

Migration unica consolidada:

1. `prisma/migrations/20260322000000_init` — schema completo com todos os indices de performance

O `Dockerfile` executa `npx prisma migrate deploy` antes de subir a aplicacao.

### Seed do primeiro administrador

`POST /api/v1/usuarios` exige papel `ADMINISTRADOR`, criando um problema de bootstrap. O script `prisma/seed.ts` resolve isso inserindo o primeiro admin diretamente no banco:

```bash
npm run seed
```

Credenciais do admin seed: `admin@oficina.com` / `Admin@123` (ou o valor de `ADMIN_SEED_PASSWORD`). O script e idempotente.

---

## Modelo de dominio atual

### Aggregate roots

- `OrdemServico`
- `Cliente`
- `Veiculo`
- `Usuario`
- `Estoque`
- `ServicoOficina`

### Entidades internas relevantes

- `ProblemaRelatado`
- `ServicoSolicitado`
- `Diagnostico`
- `Orcamento`
- `GrupoOrcamento`
- `LinhaServico`
- `HistoricoOS`
- `ConsumoPeca`
- `Peca` como entidade interna do aggregate `Estoque`

### Regras de dominio importantes

- `Cliente` e `Veiculo` nao possuem relacao estrutural direta; a ligacao acontece via `OrdemServico`
- `MecanicoResponsavel` e uma referencia para `Usuario`
- `Diagnostico` e opcional
- `Orcamento` e interno a `OrdemServico`
- `ServicoSolicitado` referencia `ServicoOficina` por ID e persiste `nomeServico` em snapshot
- `ServicoOficina` possui `nome`, `descricao`, `categoria` e `ativo`
- `HistoricoOS` guarda `evento`, `descricao`, `usuarioId`, `statusAnterior`, `statusNovo` e `criadoEm`

### Ciclo de vida da OrdemServico

Fluxo principal:

`RECEBIDA -> ATRIBUIDA -> EM_DIAGNOSTICO? -> AGUARDANDO_APROVACAO -> APROVADA -> EM_EXECUCAO -> FINALIZADA -> ENTREGUE`

Fluxo alternativo:

`AGUARDANDO_APROVACAO -> CANCELADA`

Observacao importante:

- o endpoint de diagnostico aceita OS em `ATRIBUIDA`; o use case primeiro chama `iniciarDiagnostico()` e depois registra o diagnostico
- ordens simples podem ir direto de `ATRIBUIDA` para `AGUARDANDO_APROVACAO` ao gerar o orcamento

---

## Autenticacao e autorizacao

- `POST /api/v1/auth/login` retorna `accessToken` e `refreshToken`
- `POST /api/v1/auth/refresh` usa refresh token no header `Authorization: Bearer <token>`
- `POST /api/v1/auth/logout` invalida o refresh token armazenado

Estado atual da implementacao:

- login, refresh e validacao do access token bloqueiam usuarios inativos
- `JwtStrategy` consulta o repositorio a cada validacao; nao confia apenas no payload do token
- RBAC e feito com `JwtAuthGuard`, `PapeisGuard` e decorator `@Papeis`

---

## Endpoints e papeis relevantes

### Usuarios

Acesso restrito a:

- `ADMINISTRADOR`

Tanto criacao (`POST`) quanto consulta (`GET /:id`) exigem autenticacao e papel `ADMINISTRADOR`.

### Clientes e Veiculos

Acesso restrito a:

- `ADMINISTRADOR`
- `CONSULTOR_TECNICO`

### ServicoOficina

- `POST` e `PATCH`: apenas `ADMINISTRADOR`
- `GET` lista e busca: `ADMINISTRADOR`, `CONSULTOR_TECNICO`, `MECANICO`
- a listagem atual retorna apenas servicos ativos
- `PATCH /:id/desativar` e `PATCH /:id/ativar`: apenas `ADMINISTRADOR`

### Estoque

- cadastro, entrada e atualizacao de peca: `ADMINISTRADOR`
- consulta e listagem: `ADMINISTRADOR`, `MECANICO`

### OrdemServico

- abertura, atribuicao, entrega e consultas internas: `ADMINISTRADOR`, `CONSULTOR_TECNICO`
- diagnostico, orcamento, inicio de execucao, consumo de peca e finalizacao: `MECANICO`
- aprovacao e rejeicao de orcamento: `CLIENTE`, `ADMINISTRADOR`
- rotas do mecanico usam ownership por `mecanicoResponsavelId`
- rotas do cliente (`minhas/*`, aprovar, rejeitar) usam ownership por `Cliente.usuarioId`

### Ownership do CLIENTE

O schema possui relacao explicita `Cliente.usuarioId -> Usuario.id` (campo opcional e unico).

Rotas do CLIENTE:

- `GET /api/v1/ordens-servico/minhas/lista`
- `GET /api/v1/ordens-servico/minhas/:id`
- `PATCH /api/v1/ordens-servico/:id/aprovar`
- `PATCH /api/v1/ordens-servico/:id/rejeitar`

O fluxo de ownership resolve `usuario.sub` para um `Cliente` via `BuscarClientePorUsuarioUseCase` e valida `ordemServico.clienteId === cliente.id`. ADMINISTRADOR pode aprovar/rejeitar como fallback operacional.

---

## Persistencia Prisma

Tabelas centrais:

- `usuarios`
- `clientes`
- `veiculos`
- `servicos_oficina`
- `ordens_servico`
- `problemas_relatados`
- `servicos_solicitados`
- `diagnosticos`
- `orcamentos`
- `grupos_orcamento`
- `linhas_servico`
- `historico_os`
- `consumos_peca`
- `pecas`
- `estoque`

Observacoes:

- IDs principais sao `String`
- `ordens_servico.numero` e autoincremental para referencia operacional
- valores monetarios usam `Decimal(10,2)` no banco; a conversao para `number` no dominio e segura para esta escala
- `historico_os.statusAnterior` e `historico_os.statusNovo` fazem parte do schema atual

Indices de performance:

- `ordens_servico`: `clienteId`, `status`, `mecanicoResponsavelId`
- `historico_os`: composto `(ordemServicoId, criadoEm)`
- `consumos_peca`, `problemas_relatados`, `servicos_solicitados`: `ordemServicoId`

Paginacao:

- `PaginacaoDto` limita `porPagina` entre 1 e 100 (`@Min(1)`, `@Max(100)`)

---

## Testes

Estado atual do repositorio:

- `npm run build` compila a aplicacao
- `npm test -- --runInBand` executa a suite principal sob `src/**/*.spec.ts`
- `npm run test:e2e -- --runInBand` executa apenas um smoke test em `test/app.e2e-spec.ts`
- `npm run seed` insere o admin inicial no banco (idempotente)

O e2e atual:

- sobe o `AppModule`
- faz override do `PrismaService`
- nao usa banco real
- verifica que uma rota protegida responde `401` sem JWT

Nao existe hoje uma suite automatizada de e2e com fluxo completo contra PostgreSQL.

### Collection Postman

O repositorio inclui uma collection Postman versionada em `postman/`:

- `postman/oficina-api.postman_collection.json` — fluxo completo na ordem do roteiro manual
- `postman/oficina-api.postman_environment.json` — variaveis de ambiente para localhost

As requests possuem scripts que capturam IDs e tokens automaticamente.

---

## Convencoes do repositorio

- linguagem de codigo: portugues brasileiro
- respostas de sucesso: `{ data }` ou `{ data, meta }`
- respostas de erro: `{ erro, mensagem, statusCode, caminho, timestamp }`
- Prisma nao deve vazar para a camada de dominio
- repositores fazem mapeamento explicito entre persistencia e entidades
- IDs de dominio sao value objects (`IdUnico`); nas respostas JSON serializam como `{ valor: "xx01..." }`, nao como string plana

---

## Arquivos de entrada rapida

- `src/app.module.ts`
- `src/main.ts`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/shared/database/database.module.ts`
- `src/shared/database/prisma-transaction.manager.ts`
- `src/ordem-servico/interfaces/http/v1/ordem-servico.controller.ts`
- `src/ordem-servico/domain/ordem-servico.entity.ts`
- `test/app.e2e-spec.ts`
- `postman/oficina-api.postman_collection.json`
