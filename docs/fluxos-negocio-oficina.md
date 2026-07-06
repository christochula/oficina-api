# Fluxos de Negocio - oficina_api

## 1. Objetivo

Este documento descreve os fluxos que o repositorio implementa hoje, incluindo regras de negocio ja refletidas no codigo.

---

## 2. Visao geral

Fluxo principal implementado:

1. criacao ou identificacao do usuario
2. criacao ou identificacao do cliente
3. criacao ou identificacao do veiculo
4. abertura da OS
5. atribuicao de mecanico
6. diagnostico opcional
7. geracao de orcamento
8. aprovacao ou rejeicao pelo cliente titular
9. inicio de execucao
10. consumo de pecas
11. finalizacao tecnica
12. entrega do veiculo

Fluxos de apoio:

- catalogo de servicos
- estoque
- autenticacao com refresh token
- relatorios operacionais

---

## 3. Atores

### Administrador

Atua em cadastros administrativos, estoque, consultas internas e entrega.

### Consultor Tecnico

Atua no balcao e no acompanhamento do atendimento.

### Mecanico

Atua no fluxo tecnico da OS.

### Cliente autenticado

Consulta e decide apenas sobre as proprias OS, desde que exista vinculacao para um `Cliente` ativo.

---

## 4. Fluxo de autenticacao

### Login

- rota: `POST /api/v1/auth/login`
- entrada: `email` e `senha`
- saida: `accessToken` e `refreshToken`

Regra atual:

- usuario inexistente, senha invalida ou usuario inativo recebem `401`

### Refresh

- rota: `POST /api/v1/auth/refresh`
- auth: refresh token no header `Authorization: Bearer <token>`

Regra atual:

- refresh token e validado contra `refreshTokenHash`
- usuario inativo nao consegue renovar sessao

### Logout

- rota: `POST /api/v1/auth/logout`
- auth: access token

Efeito:

- limpa `refreshTokenHash`

---

## 5. Fluxo de usuarios

### Endpoints

- `POST /api/v1/usuarios` (criacao)
- `GET /api/v1/usuarios/:id` (consulta)

### Regras implementadas

- ambos os endpoints sao restritos ao papel `ADMINISTRADOR`
- email precisa ser unico
- senha e persistida apenas como hash
- `papel` define o escopo de acesso

### Bootstrap do primeiro administrador

Como a criacao de usuario exige `ADMINISTRADOR`, o primeiro admin precisa ser inserido via seed:

```bash
npm run seed
```

O script `prisma/seed.ts` cria um admin com email `admin@oficina.com` e senha `Admin@123`. E idempotente.

### Uso relevante no ownership do cliente

Para que um cliente externo use as rotas `minhas/*` e aprove/rejeite orcamento, e necessario existir um `Usuario` com papel `CLIENTE` vinculado a um aggregate `Cliente`.

---

## 6. Fluxo de cliente

### Ator

`ADMINISTRADOR` ou `CONSULTOR_TECNICO`

### Endpoints

- `POST /api/v1/clientes`
- `GET /api/v1/clientes`
- `GET /api/v1/clientes/documento/:numeroDoc`
- `PATCH /api/v1/clientes/:id`

### Regras implementadas

- `tipoDoc` e `numeroDoc` sao obrigatorios na criacao
- `tipoDoc` e `numeroDoc` nao podem ser alterados depois
- o documento e normalizado antes de persistir
- CPF e CNPJ sao validados por utilitarios internos
- o endereco e enviado como objeto `endereco`
- criacao e update aceitam `usuarioId` opcional
- se nao houver `usuarioId`, o caso de uso tenta auto-vincular por email a um `Usuario CLIENTE` compativel e ainda nao vinculado

### Consequencia no negocio

O aggregate `Cliente` passou a ser a referencia de ownership da OS, enquanto `Usuario` continua sendo a identidade de autenticacao.

---

## 7. Fluxo de veiculo

### Ator

`ADMINISTRADOR` ou `CONSULTOR_TECNICO`

### Endpoints

- `POST /api/v1/veiculos`
- `GET /api/v1/veiculos`
- `GET /api/v1/veiculos/placa/:placa`
- `PATCH /api/v1/veiculos/:id`

### Regras implementadas

- `placa`, `renavam` e `chassi` sao imutaveis apos criacao
- update atual permite apenas `cor` e `quilometragem`
- a placa e normalizada antes de persistir e antes de consultar

---

## 8. Fluxo do catalogo de servicos

### Atores

- criacao e update: `ADMINISTRADOR`
- consulta: `ADMINISTRADOR`, `CONSULTOR_TECNICO`, `MECANICO`

### Endpoints

- `POST /api/v1/servicos-oficina`
- `GET /api/v1/servicos-oficina`
- `GET /api/v1/servicos-oficina/:id`
- `PATCH /api/v1/servicos-oficina/:id`

### Estado atual

- o catalogo possui `nome`, `descricao`, `categoria` e `ativo`
- a listagem retorna apenas servicos ativos
- ainda nao existe endpoint de desativacao/delete

### Uso no negocio

Na abertura da OS, `servicoId` e validado e o nome atual e capturado em `nomeServico`.

---

## 9. Fluxo de estoque

### Atores

- manutencao: `ADMINISTRADOR`
- consulta: `ADMINISTRADOR`, `MECANICO`

### Endpoints

- `POST /api/v1/estoque/pecas`
- `GET /api/v1/estoque`
- `GET /api/v1/estoque/pecas/:pecaId`
- `PATCH /api/v1/estoque/pecas/:pecaId`
- `PATCH /api/v1/estoque/pecas/:pecaId/entrada`

### Regras implementadas

- cadastro da peca ja cria ou inicializa o saldo
- update atual altera nome, descricao e preco de venda
- entrada aumenta `quantidadeDisponivel`

---

## 10. Fluxo principal da OrdemServico

### 10.1 Abertura

Ator:

- `ADMINISTRADOR` ou `CONSULTOR_TECNICO`

Endpoint:

- `POST /api/v1/ordens-servico`

Regras:

- a OS precisa de `clienteId` e `veiculoId`
- nao pode ser criada vazia
- precisa ter ao menos um problema relatado ou um servico solicitado
- `notasInternas` e `notasCliente` podem ser informadas

Estado resultante:

- `RECEBIDA`

### 10.2 Atribuicao de mecanico

Ator:

- `ADMINISTRADOR` ou `CONSULTOR_TECNICO`

Endpoint:

- `PATCH /api/v1/ordens-servico/:id/atribuir/:mecanicoId`

Regra:

- apenas usuario com papel `MECANICO` pode ser atribuido

Estado resultante:

- `ATRIBUIDA`

### 10.3 Diagnostico

Ator:

- `MECANICO`

Endpoint:

- `PATCH /api/v1/ordens-servico/:id/diagnostico`

Regras:

- diagnostico e opcional
- se a OS estiver `ATRIBUIDA`, o caso de uso entra em `EM_DIAGNOSTICO`
- se a OS ja estiver `EM_DIAGNOSTICO`, apenas grava o diagnostico

Estado resultante:

- `EM_DIAGNOSTICO`

### 10.4 Geracao de orcamento

Ator:

- `MECANICO`

Endpoint:

- `PATCH /api/v1/ordens-servico/:id/orcamento`

Regras:

- o input usa `grupos`
- cada grupo possui `titulo` e `linhas`
- cada linha possui `tipo`, `descricao`, `quantidade`, `valorUnitario` e `pecaId` opcional
- `notasInternas` e `notasCliente` podem ser enviadas

Caminhos de entrada:

- `ATRIBUIDA -> AGUARDANDO_APROVACAO`
- `EM_DIAGNOSTICO -> AGUARDANDO_APROVACAO`

### 10.5 Aprovacao ou rejeicao

Atores:

- `CLIENTE` (titular)
- `ADMINISTRADOR` (fallback operacional)

Endpoints:

- `PATCH /api/v1/ordens-servico/:id/aprovar`
- `PATCH /api/v1/ordens-servico/:id/rejeitar`

Regras implementadas:

- apenas OS em `AGUARDANDO_APROVACAO` podem ser decididas
- `CLIENTE`: o usuario autenticado precisa resolver para um `Cliente` ativo e a OS precisa pertencer a esse `Cliente`
- `ADMINISTRADOR`: pode aprovar/rejeitar como fallback quando o cliente nao consegue usar a aplicacao
- aprovacao leva a `APROVADA`
- rejeicao leva a `CANCELADA`

Consequencia:

- `CONSULTOR_TECNICO` nao aprova nem rejeita pela API atual

### 10.6 Inicio de execucao

Ator:

- `MECANICO`

Endpoint:

- `PATCH /api/v1/ordens-servico/:id/iniciar-execucao`

Estado resultante:

- `EM_EXECUCAO`

### 10.7 Consumo de peca

Ator:

- `MECANICO`

Endpoint:

- `PATCH /api/v1/ordens-servico/:id/consumo-peca`

Comportamento implementado:

1. a OS registra o consumo e gera evento de dominio
2. o caso de uso abre uma transacao
3. o estoque processa a saida
4. a OS e salva no mesmo contexto transacional
5. os eventos sao limpos apenas apos sucesso

Consequencia:

- baixa de estoque e persistencia da OS confirmam ou falham juntas

### 10.8 Finalizacao tecnica

Ator:

- `MECANICO`

Endpoint:

- `PATCH /api/v1/ordens-servico/:id/finalizar`

Estado resultante:

- `FINALIZADA`

### 10.9 Entrega do veiculo

Atores:

- `ADMINISTRADOR`
- `CONSULTOR_TECNICO`

Endpoint:

- `PATCH /api/v1/ordens-servico/:id/entregar`

Estado resultante:

- `ENTREGUE`

---

## 11. Fluxos de consulta por ator

### Consultas internas

`ADMINISTRADOR` e `CONSULTOR_TECNICO` usam:

- `GET /api/v1/ordens-servico`
- `GET /api/v1/ordens-servico/:id`

### Consultas do mecanico

`MECANICO` usa:

- `GET /api/v1/ordens-servico/mecanico/minhas-ordens`
- `GET /api/v1/ordens-servico/mecanico/:id`

Regra:

- o use case valida `mecanicoResponsavelId`

### Consultas do cliente

`CLIENTE` usa:

- `GET /api/v1/ordens-servico/minhas/lista`
- `GET /api/v1/ordens-servico/minhas/:id`

Regra:

- o usuario autenticado e resolvido para `Cliente` por `Cliente.usuarioId`
- a consulta so retorna ordens em que `ordemServico.clienteId` corresponde ao `Cliente.id` resolvido

---

## 12. Fluxo de relatorios operacionais

### Atores

- `ADMINISTRADOR`
- `CONSULTOR_TECNICO`

### Endpoints

- `GET /api/v1/ordens-servico/relatorio/lead-time`
- `GET /api/v1/ordens-servico/relatorio/kpis`
- `GET /api/v1/ordens-servico/relatorio/tempo-ciclo`

### Fonte de dados

Todos os relatorios usam o historico da OS.

### Implementacao atual

- os calculos rodam na camada de aplicacao
- o repositorio carrega OS com historico completo
- isso e adequado para o volume atual do MVP, mas nao e um desenho analitico de alta escala

---

## 13. Regras globais consolidadas

- cliente e veiculo devem existir antes da abertura da OS
- cliente e veiculo nao possuem relacao estrutural direta
- a OS precisa ter problema relatado ou servico solicitado
- diagnostico e opcional
- orcamento e obrigatorio antes da execucao
- aprovacao ou rejeicao do orcamento sao exclusivas do cliente titular
- execucao depende de aprovacao
- entrega depende de finalizacao tecnica
- o fluxo termina em `ENTREGUE` ou `CANCELADA`
- historico da OS e append-only
- consumo de peca e transacionalmente consistente entre OS e estoque
