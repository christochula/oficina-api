# Guia de Teste End-to-End - oficina_api

## 1. Objetivo

Este guia descreve:

- o estado atual dos testes automatizados
- a preparacao de ambiente com PostgreSQL real
- um roteiro manual para validar o fluxo principal
- os cenarios de ownership do cliente apos a introducao de `Cliente.usuarioId`

---

## 2. Estado atual dos testes automatizados

### Suite principal

```bash
npm test -- --runInBand
```

Estado verificado mais recente:

- `43` suites
- `266` testes
- foco em dominio, validators e casos de uso

### Smoke e2e atual

```bash
npm run test:e2e -- --runInBand
```

Arquivo atual:

- `test/app.e2e-spec.ts`

O que esse e2e faz hoje:

- sobe o `AppModule`
- faz override do `PrismaService`
- nao conecta em PostgreSQL real
- valida que `GET /api/v1/ordens-servico` responde `401` sem JWT

Isso cobre bootstrap, prefixo `/api`, versionamento `/v1` e guards basicos, mas nao o fluxo funcional completo.

---

## 3. Preparacao do ambiente com banco real

### 3.1 Variaveis de ambiente

```bash
cp .env.example .env
```

Revise principalmente:

- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

### 3.2 Subir o banco

```bash
docker compose up -d db
```

### 3.3 Aplicar migrations

Historico atual:

1. `20260322000000_init`

Comandos:

```bash
npx prisma migrate deploy
npx prisma generate
```

### 3.4 Seed do primeiro administrador

`POST /api/v1/usuarios` exige papel `ADMINISTRADOR`, portanto o primeiro usuario precisa ser inserido via seed:

```bash
npm run seed
```

O script `prisma/seed.ts` cria um usuario administrador com:

- email: `admin@oficina.com`
- senha: `Admin@123`

O comando e idempotente; se o admin ja existir, nao duplica.

### 3.5 Subir a API

```bash
npm run start:dev
```

URLs uteis:

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`

### 3.6 Prisma Studio

Opcional:

```bash
npx prisma studio
```

---

## 4. Checklist tecnico minimo

Antes do roteiro manual:

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

---

## 5. Roteiro manual de regressao

## 5.1 Criar usuarios

Pre-requisito:

- o seed do passo 3.4 ja deve ter sido executado para criar o admin inicial

Rotas:

- `POST /api/v1/auth/login` (publico)
- `POST /api/v1/usuarios` (requer `ADMINISTRADOR`)

Fluxo:

1. fazer login com o admin seed (`admin@oficina.com` / `Admin@123`) para obter o `accessToken`
2. usar esse token para criar os demais usuarios via `POST /api/v1/usuarios`

Sugestao de usuarios a criar:

- `CONSULTOR_TECNICO`
- `MECANICO`
- `CLIENTE` titular da OS
- `CLIENTE` nao titular
- opcionalmente um `CLIENTE` sem cliente vinculado

Verificacoes:

- criacao de usuario exige autenticacao e papel `ADMINISTRADOR`
- login retorna `accessToken` e `refreshToken`
- usuarios inativos nao conseguem logar

## 5.2 Criar cliente e formar o vinculo com usuario CLIENTE

Rotas:

- `POST /api/v1/clientes`
- `PATCH /api/v1/clientes/:id`

O modelo atual exige que o `CLIENTE` autenticado esteja vinculado a um aggregate `Cliente`.

Formas suportadas:

- criar `Cliente` com o mesmo email do `Usuario CLIENTE`
- informar `usuarioId` explicitamente no payload de criacao ou update

Exemplo de criacao:

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

## 5.3 Criar servicos de catalogo

Rotas:

- `POST /api/v1/servicos-oficina`
- `GET /api/v1/servicos-oficina`

Observacoes:

- apenas `ADMINISTRADOR` cria ou atualiza
- a listagem retorna apenas servicos ativos
- o repositorio ainda nao expoe endpoint de desativacao/delete

## 5.4 Criar pecas e estoque

Rotas:

- `POST /api/v1/estoque/pecas`
- `PATCH /api/v1/estoque/pecas/:pecaId/entrada`
- `GET /api/v1/estoque`

Verificacoes:

- cadastro inicializa saldo
- entrada incrementa `quantidadeDisponivel`

## 5.5 Criar veiculo

Rotas:

- `POST /api/v1/veiculos`
- `GET /api/v1/veiculos/placa/:placa`

Verificacoes:

- placa e normalizada
- update posterior aceita apenas `cor` e `quilometragem`

## 5.6 Abrir a OS

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
  "notasCliente": "Veiculo recebido com 62.350 km"
}
```

Verificacoes:

- status inicial `RECEBIDA`
- `historico_os` com `ORDEM_ABERTA`
- `servicos_solicitados.nomeServico` preenchido como snapshot

## 5.7 Atribuir mecanico

Rota:

- `PATCH /api/v1/ordens-servico/:id/atribuir/:mecanicoId`

Verificacoes:

- status `ATRIBUIDA`
- evento `MECANICO_ATRIBUIDO`

## 5.8 Diagnostico opcional

Rota:

- `PATCH /api/v1/ordens-servico/:id/diagnostico`

Verificacoes:

- se a OS estava `ATRIBUIDA`, o caso de uso entra em `EM_DIAGNOSTICO`
- `diagnosticos` recebe um registro
- `historico_os` registra `DIAGNOSTICO_REGISTRADO`

## 5.9 Gerar orcamento

Rota:

- `PATCH /api/v1/ordens-servico/:id/orcamento`

Verificacoes:

- status `AGUARDANDO_APROVACAO`
- `orcamentos`, `grupos_orcamento` e `linhas_servico` preenchidos

## 5.10 Validar ownership do CLIENTE

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
- `historico_os` registra `ORCAMENTO_APROVADO` ou `ORCAMENTO_REJEITADO`

## 5.11 Iniciar execucao

Rota:

- `PATCH /api/v1/ordens-servico/:id/iniciar-execucao`

Verificacao:

- status `EM_EXECUCAO`

## 5.12 Registrar consumo de peca

Rota:

- `PATCH /api/v1/ordens-servico/:id/consumo-peca`

Verificacoes:

- novo registro em `consumos_peca`
- baixa correspondente no estoque
- evento `PECA_CONSUMIDA`
- OS e estoque confirmam juntos, porque o caso de uso usa uma transacao compartilhada

## 5.13 Finalizar e entregar

Rotas:

- `PATCH /api/v1/ordens-servico/:id/finalizar`
- `PATCH /api/v1/ordens-servico/:id/entregar`

Verificacoes:

- `FINALIZADA`
- `ENTREGUE`
- eventos `ORDEM_FINALIZADA` e `VEICULO_ENTREGUE`

## 5.14 Validar relatorios

Rotas:

- `GET /api/v1/ordens-servico/relatorio/lead-time`
- `GET /api/v1/ordens-servico/relatorio/kpis`
- `GET /api/v1/ordens-servico/relatorio/tempo-ciclo`

Verificacoes:

- lead-time usa a OS ate `VEICULO_ENTREGUE`
- KPIs e tempo de ciclo usam o historico da OS

---

## 6. Consultas de apoio no Prisma Studio

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

## 7. Collection Postman

O repositorio inclui uma collection Postman versionada em `postman/`:

- `oficina-api.postman_collection.json` — requisicoes organizadas na ordem do roteiro (5.1 a 5.14)
- `oficina-api.postman_environment.json` — variaveis de ambiente para `http://localhost:3000/api/v1`

Cada request possui scripts de teste que capturam IDs e tokens automaticamente nas variaveis de ambiente, permitindo executar o fluxo completo em sequencia.

Para importar: abra o Postman, clique em Import e selecione ambos os arquivos. Selecione o environment "Oficina API - Local" antes de executar.

Observacao sobre IDs nas respostas: as entidades de dominio serializam `id` como value object `{ valor: "xx01..." }`. Os scripts da collection ja tratam ambos os formatos (string direta ou objeto com `.valor`).

---

## 8. Limitacoes atuais

- o repositorio ainda nao possui e2e automatizado completo com PostgreSQL real
- a suite e2e versionada continua sendo um smoke test

O proximo passo natural, quando o produto estiver funcionalmente fechado, e automatizar o roteiro manual acima com fixtures controladas.
