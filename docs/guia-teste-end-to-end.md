# Guia de Teste End-to-End - oficina_api

## 1. Objetivo

Este guia tem duas funcoes:

- orientar os professores a subir a aplicacao localmente com Docker e validar os principais requisitos da entrega
- servir como roteiro base para gravar o video de demonstracao da aplicacao

O ponto mais importante do ambiente e a `DATABASE_URL`:

- use `db` quando a API roda dentro do Docker Compose
- use `localhost` quando comandos Node/Prisma/API rodam direto no host

---

## 2. Pre-requisitos

Antes de executar o roteiro, confirme:

- Docker Desktop instalado, aberto e com o daemon em execucao
- Docker Compose disponivel via `docker compose`
- Node.js e npm instalados, caso va rodar testes ou API fora do Docker
- porta `3000` livre para a API
- porta `5432` livre para o PostgreSQL
- Postman instalado, caso va usar a collection versionada em `postman/`

Versoes usadas na validacao local deste guia em 26/04/2026:

- Node.js `v24.15.0`
- npm `11.12.1`
- Docker `29.4.0`
- Docker Compose `v5.1.2`

Execute todos os comandos a partir da raiz do repositorio.

---

## 3. Roteiro recomendado para a banca: API e banco no Docker

Este e o caminho mais simples para os professores validarem a aplicacao sem depender do Node local para iniciar a API.

### 3.1 Preparar `.env`

```bash
cp .env.example .env
```

Para o modo Docker completo, mantenha a `DATABASE_URL` apontando para o servico `db`:

```env
DATABASE_URL=postgresql://oficina:oficina_senha@db:5432/oficina_db
```

Confira tambem:

```env
POSTGRES_USER=oficina
POSTGRES_PASSWORD=oficina_senha
POSTGRES_DB=oficina_db
POSTGRES_PORT=5432
JWT_SECRET=troque_por_um_segredo_forte
JWT_REFRESH_SECRET=troque_por_outro_segredo_forte
ADMIN_SEED_PASSWORD=Admin@123
```

### 3.2 Subir banco e API

```bash
docker compose up -d --build
```

O Docker Compose executa `npx prisma migrate deploy` no servico `migrate` antes de iniciar a API.

Valide se os containers estao ativos:

```bash
docker compose ps
```

Resultado esperado:

- `oficina_db` com status `healthy`
- `migrate` concluido com sucesso
- `oficina_api` com status `Up`
- porta `3000` publicada para a API
- porta `5432` publicada para o banco

### 3.3 Criar o administrador inicial

No modo Docker, use o seed compilado:

```bash
docker compose exec -T api node dist/prisma/seed.js
```

Credenciais criadas pelo seed:

- email: `admin@oficina.com`
- senha: `Admin@123`

Observacao: dentro do container, `docker compose exec -T api npm run seed` pode falhar com `ERR_UNKNOWN_FILE_EXTENSION` ao executar `prisma/seed.ts`. Por isso, use `node dist/prisma/seed.js`.

### 3.4 Acessar a API

URLs uteis:

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`

Teste rapido de login:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@oficina.com\",\"senha\":\"Admin@123\"}"
```

No PowerShell, se preferir:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/v1/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"admin@oficina.com","senha":"Admin@123"}'
```

Resposta esperada:

- `accessToken`
- `refreshToken`

### 3.5 Parar o ambiente

```bash
docker compose down
```

Para apagar tambem o volume do banco e recomecar do zero:

```bash
docker compose down -v
```

Use `down -v` apenas quando quiser limpar todos os dados locais.

---

## 4. Roteiro para desenvolvimento, testes automatizados e video: banco no Docker, API no host

Use este caminho se quiser rodar `npm run start:dev`, `npm test`, `npm run test:e2e`, Prisma Studio ou depurar a API localmente.

### 4.1 Preparar dependencias Node

```bash
npm ci
```

### 4.2 Preparar `.env` para comandos no host

Quando Prisma, seed, testes ou API rodam no host, a `DATABASE_URL` precisa apontar para `localhost`:

```env
DATABASE_URL=postgresql://oficina:oficina_senha@localhost:5432/oficina_db
```

Nao use `db` neste modo. O hostname `db` so existe dentro da rede do Docker Compose.

### 4.3 Subir apenas o banco

```bash
docker compose up -d db
```

Valide:

```bash
docker compose ps
```

### 4.4 Aplicar migrations e gerar Prisma Client

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4.5 Criar o administrador inicial

```bash
npm run seed
```

Credenciais:

- email: `admin@oficina.com`
- senha: `Admin@123`

### 4.6 Subir a API em modo desenvolvimento

Antes de usar `start:dev`, confirme que o container `api` nao esta rodando na porta `3000`.

```bash
docker compose stop api
npm run start:dev
```

URLs:

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`

### 4.7 Prisma Studio

Opcional:

```bash
npx prisma studio
```

---

## 5. Checklist tecnico minimo

Execute depois de preparar banco, migrations e seed.

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Estado validado localmente em 26/04/2026:

- `npm run build`: passou
- `npm test -- --runInBand`: `56` suites e `291` testes passaram
- `npm run test:e2e -- --runInBand`: `2` suites e `2` testes passaram

Observacoes:

- `test/app.e2e-spec.ts` usa mock do `PrismaService` e valida o bootstrap/guard basico
- `test/ordem-servico-fluxo.e2e-spec.ts` usa PostgreSQL real e executa o fluxo feliz da OS
- `test/setup-e2e.ts` ajusta `DATABASE_URL` de `db` para `localhost` quando o e2e roda fora de container
- esse ajuste existe nos testes, mas nao existe em `npx prisma migrate deploy`, `npm run seed` ou `npm run start`

---

## 6. Collection Postman

O repositorio inclui uma collection Postman em `postman/`:

- `oficina-api.postman_collection.json`
- `oficina-api.postman_environment.json`

Para usar:

1. suba a API por um dos roteiros acima
2. importe os dois arquivos no Postman
3. selecione o environment `Oficina API - Local`
4. execute as requisicoes na ordem da collection

A collection usa `http://localhost:3000/api/v1` e possui scripts que capturam tokens e IDs automaticamente.

Observacao sobre IDs: algumas respostas serializam `id` como value object `{ "valor": "xx01..." }`. Os scripts da collection ja tratam string direta e objeto com `.valor`.

---

## 7. Roteiro manual de regressao e demonstracao

Use esta ordem para validar os requisitos e tambem como base para o video.

### 7.1 Login do administrador

Rota:

- `POST /api/v1/auth/login`

Use:

- email: `admin@oficina.com`
- senha: `Admin@123`

Verificacoes:

- login retorna `accessToken` e `refreshToken`
- as proximas rotas administrativas usam `Authorization: Bearer <accessToken>`

### 7.2 Criar usuarios

Rota:

- `POST /api/v1/usuarios` requer `ADMINISTRADOR`

Usuarios sugeridos:

- `CONSULTOR_TECNICO`
- `MECANICO`
- `CLIENTE` titular da OS
- `CLIENTE` nao titular
- opcionalmente um `CLIENTE` sem cliente vinculado

Verificacoes:

- criacao de usuario exige autenticacao
- criacao de usuario exige papel `ADMINISTRADOR`
- usuarios inativos nao conseguem logar

### 7.3 Criar cliente e vincular ao usuario CLIENTE

Rotas:

- `POST /api/v1/clientes`
- `PATCH /api/v1/clientes/:id`

O modelo atual exige que o usuario autenticado com papel `CLIENTE` esteja vinculado a um aggregate `Cliente`.

Formas suportadas:

- criar `Cliente` com o mesmo email do `Usuario CLIENTE`
- informar `usuarioId` explicitamente no payload de criacao ou update

Exemplo:

```json
{
  "tipoDoc": "CPF",
  "numeroDoc": "529.982.247-25",
  "nome": "Maria Silva",
  "email": "maria@email.com",
  "telefone": "11999999999",
  "usuarioId": "us_xxx",
  "endereco": {
    "logradouro": "Rua das Flores",
    "numero": "123",
    "bairro": "Centro",
    "cidade": "Sao Paulo",
    "estado": "SP",
    "cep": "01000-000"
  }
}
```

Verificacoes:

- documento e salvo normalizado
- `tipoDoc` e `numeroDoc` continuam imutaveis
- `clientes.usuarioId` fica preenchido
- vinculo so aceita usuario com papel `CLIENTE`

### 7.4 Criar servicos de catalogo

Rotas:

- `POST /api/v1/servicos-oficina`
- `GET /api/v1/servicos-oficina`
- `PATCH /api/v1/servicos-oficina/:id/desativar`
- `PATCH /api/v1/servicos-oficina/:id/ativar`

Verificacoes:

- apenas `ADMINISTRADOR` cria ou atualiza
- listagem retorna apenas servicos ativos
- servico desativado pode ser reativado

### 7.5 Criar pecas e estoque

Rotas:

- `POST /api/v1/estoque/pecas`
- `PATCH /api/v1/estoque/pecas/:pecaId/entrada`
- `GET /api/v1/estoque`
- `PATCH /api/v1/estoque/pecas/:pecaId/desativar`
- `PATCH /api/v1/estoque/pecas/:pecaId/ativar`

Verificacoes:

- cadastro inicializa saldo
- entrada incrementa `quantidadeDisponivel`
- peca desativada pode ser reativada

### 7.6 Criar veiculo

Rotas:

- `POST /api/v1/veiculos`
- `GET /api/v1/veiculos/placa/:placa`
- `PATCH /api/v1/veiculos/:id/desativar`
- `PATCH /api/v1/veiculos/:id/ativar`

Verificacoes:

- placa e normalizada
- update posterior aceita apenas `cor` e `quilometragem`

### 7.7 Abrir a OS

Rota:

- `POST /api/v1/ordens-servico`

Exemplo:

```json
{
  "clienteId": "cl_xxx",
  "veiculoId": "ve_xxx",
  "problemasRelatados": [
    { "descricao": "Motor apresentando ruido metalico" }
  ],
  "servicosSolicitados": [
    {
      "servicoId": "sv_xxx",
      "observacao": "Ultima troca ha 12000 km"
    }
  ],
  "notasInternas": "Cliente relatou piora a frio",
  "notasCliente": "Veiculo recebido com 62350 km"
}
```

Verificacoes:

- status inicial `RECEBIDA`
- `historico_os` registra `ORDEM_ABERTA`
- `servicos_solicitados.nomeServico` e salvo como snapshot

### 7.8 Atribuir mecanico

Rota:

- `PATCH /api/v1/ordens-servico/:id/atribuir/:mecanicoId`

Verificacoes:

- status muda para `ATRIBUIDA`
- historico registra `MECANICO_ATRIBUIDO`

### 7.9 Registrar diagnostico

Rota:

- `PATCH /api/v1/ordens-servico/:id/diagnostico`

Verificacoes:

- se a OS estava `ATRIBUIDA`, o caso de uso entra em `EM_DIAGNOSTICO`
- `diagnosticos` recebe um registro
- historico registra `DIAGNOSTICO_REGISTRADO`

### 7.10 Gerar orcamento

Rota:

- `PATCH /api/v1/ordens-servico/:id/orcamento`

Verificacoes:

- status muda para `AGUARDANDO_APROVACAO`
- `orcamentos`, `grupos_orcamento` e `linhas_servico` sao preenchidos

### 7.11 Validar ownership do CLIENTE

Rotas:

- `GET /api/v1/ordens-servico/minhas/lista`
- `GET /api/v1/ordens-servico/minhas/:id`
- `PATCH /api/v1/ordens-servico/:id/aprovar`
- `PATCH /api/v1/ordens-servico/:id/rejeitar`

Cenarios que devem passar:

1. o `CLIENTE` vinculado ao `Cliente` da OS consegue listar suas ordens
2. esse mesmo `CLIENTE` consegue buscar a OS pelo ID
3. esse mesmo `CLIENTE` consegue aprovar ou rejeitar o orcamento

Cenarios que devem falhar com `403`:

1. outro `CLIENTE` autenticado, vinculado a outro `Cliente`
2. `CLIENTE` autenticado sem `Cliente` vinculado
3. `CLIENTE` vinculado a cliente inativo

Verificacoes adicionais:

- aprovacao leva a `APROVADA`
- rejeicao leva a `CANCELADA`
- historico registra `ORCAMENTO_APROVADO` ou `ORCAMENTO_REJEITADO`
- apesar de o decorator HTTP tambem listar `ADMINISTRADOR` em aprovar/rejeitar, os casos de uso resolvem ownership por `Cliente.usuarioId`; valide aprovacao/rejeicao com o `CLIENTE` titular

### 7.12 Iniciar execucao

Rota:

- `PATCH /api/v1/ordens-servico/:id/iniciar-execucao`

Verificacao:

- status muda para `EM_EXECUCAO`

### 7.13 Registrar consumo de peca

Rota:

- `PATCH /api/v1/ordens-servico/:id/consumo-peca`

Verificacoes:

- cria registro em `consumos_peca`
- baixa o estoque correspondente
- historico registra `PECA_CONSUMIDA`
- OS e estoque sao persistidos juntos por transacao compartilhada

### 7.14 Finalizar e entregar

Rotas:

- `PATCH /api/v1/ordens-servico/:id/finalizar`
- `PATCH /api/v1/ordens-servico/:id/entregar`

Verificacoes:

- status muda para `FINALIZADA`
- status muda para `ENTREGUE`
- historico registra `ORDEM_FINALIZADA` e `VEICULO_ENTREGUE`

### 7.15 Consultar status publico

Rota:

- `GET /api/v1/ordens-servico/publico/status/:numero/:numeroDoc`

Verificacoes:

- nao exige JWT
- retorna o status da OS a partir do numero da OS e documento do cliente
- para o caminho feliz, status final esperado e `ENTREGUE`

### 7.16 Validar relatorios

Rotas:

- `GET /api/v1/ordens-servico/relatorio/lead-time`
- `GET /api/v1/ordens-servico/relatorio/kpis`
- `GET /api/v1/ordens-servico/relatorio/tempo-ciclo`

Verificacoes:

- lead-time usa a OS ate `VEICULO_ENTREGUE`
- KPIs e tempo de ciclo usam o historico da OS

---

## 8. Consultas de apoio no Prisma Studio

Tabelas mais uteis:

- `usuarios`
- `clientes`
- `veiculos`
- `servicos_oficina`
- `ordens_servico`
- `servicos_solicitados`
- `diagnosticos`
- `orcamentos`
- `grupos_orcamento`
- `linhas_servico`
- `historico_os`
- `consumos_peca`
- `pecas`
- `estoque`

Checklist util:

- `clientes.usuarioId` coerente com o usuario `CLIENTE`
- `senhaHash` nunca em texto puro
- `refreshTokenHash` preenchido apos login e limpo apos logout
- `servicos_solicitados.nomeServico` preservado
- `historico_os.statusAnterior` e `statusNovo` coerentes
- `estoque.quantidadeDisponivel` reduzido apos consumo

---

## 9. Solucao de problemas

### Docker Desktop fechado

Erro comum:

```text
failed to connect to the docker API
```

Solucao:

- abra o Docker Desktop
- aguarde o engine iniciar
- rode novamente `docker compose up -d db` ou `docker compose up -d --build`

### Comando no host tentando acessar `db:5432`

Erro comum:

```text
Can't reach database server at `db:5432`
```

Isso acontece quando `npm run seed`, `npm run start`, `npm run start:dev` ou `npx prisma migrate deploy` rodam no host com `DATABASE_URL` apontando para `db`.

Solucao para modo host:

```env
DATABASE_URL=postgresql://oficina:oficina_senha@localhost:5432/oficina_db
```

### API no Docker e API no host ao mesmo tempo

Erro comum:

```text
EADDRINUSE: address already in use :::3000
```

Solucao:

```bash
docker compose stop api
```

Depois rode:

```bash
npm run start:dev
```

### Seed dentro do container

Se este comando falhar:

```bash
docker compose exec -T api npm run seed
```

Use:

```bash
docker compose exec -T api node dist/prisma/seed.js
```

---

## 10. Limitacoes atuais

- existe um e2e automatizado de caminho feliz com PostgreSQL real
- a cobertura automatizada ainda nao inclui todos os cenarios negativos de ownership
- cliente inativo, cliente sem vinculo, rejeicao de orcamento e variacoes de permissao por papel continuam como validacoes manuais no roteiro

O proximo passo natural e automatizar os cenarios manuais restantes com fixtures controladas.
