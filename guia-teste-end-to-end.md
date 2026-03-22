# Guia de Teste End-to-End — oficina_api

Guia para subir o ambiente localmente, exercitar todos os endpoints e verificar a persistência no banco.

---

## Ambiente Postman — Variáveis de Ambiente

Crie um **Environment** no Postman chamado `oficina_local` com as seguintes variáveis:

| Variável | Valor inicial | Descrição |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | URL base da API |
| `TOKEN_ADMIN` | _(vazio)_ | Access token do administrador |
| `TOKEN_CONSULTOR` | _(vazio)_ | Access token do consultor técnico |
| `TOKEN_MECANICO` | _(vazio)_ | Access token do mecânico |
| `TOKEN_CLIENTE` | _(vazio)_ | Access token do cliente |
| `ID_USUARIO_ADMIN` | _(vazio)_ | ID do usuário admin |
| `ID_USUARIO_MECANICO` | _(vazio)_ | ID do usuário mecânico |
| `ID_SERVICO_TROCA_OLEO` | _(vazio)_ | ID do serviço no catálogo |
| `ID_SERVICO_ALINHAMENTO` | _(vazio)_ | ID do serviço no catálogo |
| `ID_PECA_OLEO` | _(vazio)_ | ID da peça no estoque |
| `ID_PECA_FILTRO` | _(vazio)_ | ID da peça no estoque |
| `ID_CLIENTE` | _(vazio)_ | ID do cliente (cl...) |
| `ID_VEICULO` | _(vazio)_ | ID do veículo (ve...) |
| `ID_OS` | _(vazio)_ | ID da ordem de serviço ativa |

> **Dica:** Todas as requisições usam `Authorization: Bearer {{TOKEN_xxx}}` — configure isso na aba **Auth** de cada request ou numa Collection com herança de auth.

---

## Fase 0 — Subir o ambiente

```bash
# 1. Copiar o .env
cp .env.example .env
# Editar .env: ajustar DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET

# 2. Subir PostgreSQL via Docker
docker-compose up -d

# 3. Executar migrações e gerar Prisma Client
npx prisma migrate deploy
npx prisma generate

# 4. Subir a aplicação
npm run start:dev
# API disponível em http://localhost:3000/api/v1
# Swagger em http://localhost:3000/api/docs

# 5. Abrir Prisma Studio (banco visual)
npx prisma studio
# Disponível em http://localhost:5555
```

---

## Fase 1 — Criar usuários (banco vazio)

Endpoint público — não requer autenticação.

### 1.1 — Criar ADMINISTRADOR

```
POST {{BASE_URL}}/api/v1/usuarios
Content-Type: application/json
```
```json
{
  "nome": "Admin da Oficina",
  "email": "admin@oficina.com",
  "senha": "Admin@123",
  "papel": "ADMINISTRADOR"
}
```
✅ Salvar `data.id` → variável `ID_USUARIO_ADMIN`

### 1.2 — Criar CONSULTOR TÉCNICO

```
POST {{BASE_URL}}/api/v1/usuarios
Content-Type: application/json
```
```json
{
  "nome": "Carlos Consultor",
  "email": "consultor@oficina.com",
  "senha": "Consultor@123",
  "papel": "CONSULTOR_TECNICO"
}
```

### 1.3 — Criar MECÂNICO

```
POST {{BASE_URL}}/api/v1/usuarios
Content-Type: application/json
```
```json
{
  "nome": "João Mecânico",
  "email": "mecanico@oficina.com",
  "senha": "Mecanico@123",
  "papel": "MECANICO"
}
```
✅ Salvar `data.id` → variável `ID_USUARIO_MECANICO`

### 1.4 — Criar CLIENTE (usuário externo)

```
POST {{BASE_URL}}/api/v1/usuarios
Content-Type: application/json
```
```json
{
  "nome": "Pedro Cliente",
  "email": "pedro@email.com",
  "senha": "Cliente@123",
  "papel": "CLIENTE"
}
```

**🔍 Prisma Studio — verificar tabela `usuarios`:**
- 4 registros criados com IDs prefixados `us...`
- Senhas armazenadas como hash bcrypt (nunca em texto puro)
- `refreshTokenHash` nulo (nenhum login feito ainda)

---

## Fase 2 — Login com cada papel

### 2.1 — Login ADMINISTRADOR

```
POST {{BASE_URL}}/api/v1/auth/login
Content-Type: application/json
```
```json
{
  "email": "admin@oficina.com",
  "senha": "Admin@123"
}
```
✅ Salvar `data.accessToken` → `TOKEN_ADMIN`

### 2.2 — Login CONSULTOR TÉCNICO

```
POST {{BASE_URL}}/api/v1/auth/login
Content-Type: application/json
```
```json
{
  "email": "consultor@oficina.com",
  "senha": "Consultor@123"
}
```
✅ Salvar `data.accessToken` → `TOKEN_CONSULTOR`

### 2.3 — Login MECÂNICO

```
POST {{BASE_URL}}/api/v1/auth/login
Content-Type: application/json
```
```json
{
  "email": "mecanico@oficina.com",
  "senha": "Mecanico@123"
}
```
✅ Salvar `data.accessToken` → `TOKEN_MECANICO`

### 2.4 — Login CLIENTE

```
POST {{BASE_URL}}/api/v1/auth/login
Content-Type: application/json
```
```json
{
  "email": "pedro@email.com",
  "senha": "Cliente@123"
}
```
✅ Salvar `data.accessToken` → `TOKEN_CLIENTE`

**🔍 Prisma Studio — verificar tabela `usuarios`:**
- `refreshTokenHash` agora preenchido para os 4 usuários

---

## Fase 3 — Catálogo de serviços (ServicoOficina)

> **Token:** `TOKEN_ADMIN` (somente ADMINISTRADOR pode criar serviços)

### 3.1 — Criar serviço: Troca de Óleo

```
POST {{BASE_URL}}/api/v1/servicos-oficina
Authorization: Bearer {{TOKEN_ADMIN}}
Content-Type: application/json
```
```json
{
  "nome": "Troca de Óleo do Motor",
  "descricao": "Substituição do óleo lubrificante e filtro de óleo"
}
```
✅ Salvar `data.id` → `ID_SERVICO_TROCA_OLEO`

### 3.2 — Criar serviço: Alinhamento e Balanceamento

```
POST {{BASE_URL}}/api/v1/servicos-oficina
Authorization: Bearer {{TOKEN_ADMIN}}
Content-Type: application/json
```
```json
{
  "nome": "Alinhamento e Balanceamento",
  "descricao": "Alinhamento da direção e balanceamento dos 4 pneus"
}
```
✅ Salvar `data.id` → `ID_SERVICO_ALINHAMENTO`

### 3.3 — Criar serviço: Diagnóstico Eletrônico

```
POST {{BASE_URL}}/api/v1/servicos-oficina
Authorization: Bearer {{TOKEN_ADMIN}}
Content-Type: application/json
```
```json
{
  "nome": "Diagnóstico Eletrônico",
  "descricao": "Leitura de falhas via scanner OBD"
}
```

### 3.4 — Listar catálogo

```
GET {{BASE_URL}}/api/v1/servicos-oficina?pagina=1&porPagina=10
Authorization: Bearer {{TOKEN_CONSULTOR}}
```

### 3.5 — Buscar serviço por ID

```
GET {{BASE_URL}}/api/v1/servicos-oficina/{{ID_SERVICO_TROCA_OLEO}}
Authorization: Bearer {{TOKEN_MECANICO}}
```

### 3.6 — Atualizar serviço (ADMIN)

```
PATCH {{BASE_URL}}/api/v1/servicos-oficina/{{ID_SERVICO_ALINHAMENTO}}
Authorization: Bearer {{TOKEN_ADMIN}}
Content-Type: application/json
```
```json
{
  "descricao": "Alinhamento 3D da direção e balanceamento computadorizado dos 4 pneus"
}
```

**🔍 Prisma Studio — verificar tabela `servicos_oficina`:**
- 3 registros com IDs prefixados `sv...`
- `ativo = true` em todos
- Sem campo `precoBase` (preço é definido pelo mecânico no orçamento)

---

## Fase 4 — Estoque de peças

> **Token:** `TOKEN_ADMIN`

### 4.1 — Registrar peça: Óleo 5W30

```
POST {{BASE_URL}}/api/v1/estoque/pecas
Authorization: Bearer {{TOKEN_ADMIN}}
Content-Type: application/json
```
```json
{
  "codigo": "OL-5W30-1L",
  "nome": "Óleo Motor 5W30 1L",
  "descricao": "Óleo sintético para motor",
  "precoVenda": 38.90,
  "quantidadeInicial": 50,
  "quantidadeMinima": 10
}
```
✅ Salvar `data.peca.id` → `ID_PECA_OLEO`

### 4.2 — Registrar peça: Filtro de óleo

```
POST {{BASE_URL}}/api/v1/estoque/pecas
Authorization: Bearer {{TOKEN_ADMIN}}
Content-Type: application/json
```
```json
{
  "codigo": "FO-GOLF-001",
  "nome": "Filtro de Óleo Golf G6",
  "descricao": "Filtro de óleo original VW",
  "precoVenda": 45.00,
  "quantidadeInicial": 20,
  "quantidadeMinima": 5
}
```
✅ Salvar `data.peca.id` → `ID_PECA_FILTRO`

### 4.3 — Listar estoque

```
GET {{BASE_URL}}/api/v1/estoque?pagina=1&porPagina=10
Authorization: Bearer {{TOKEN_ADMIN}}
```

### 4.4 — Buscar peça por ID

```
GET {{BASE_URL}}/api/v1/estoque/pecas/{{ID_PECA_OLEO}}
Authorization: Bearer {{TOKEN_ADMIN}}
```

### 4.5 — Dar entrada adicional

```
PATCH {{BASE_URL}}/api/v1/estoque/pecas/{{ID_PECA_OLEO}}/entrada
Authorization: Bearer {{TOKEN_ADMIN}}
Content-Type: application/json
```
```json
{
  "quantidade": 10
}
```
✅ `quantidadeDisponivel` deve ter aumentado de 50 para 60.

### 4.6 — Atualizar dados da peça

```
PATCH {{BASE_URL}}/api/v1/estoque/pecas/{{ID_PECA_FILTRO}}
Authorization: Bearer {{TOKEN_ADMIN}}
Content-Type: application/json
```
```json
{
  "precoVenda": 48.50
}
```

**🔍 Prisma Studio — verificar tabelas `pecas` e `estoque`:**
- 2 registros em `pecas` com IDs `pc...`
- 2 registros em `estoque` vinculados às peças com as quantidades corretas

---

## Fase 5 — Cliente e Veículo

> **Token:** `TOKEN_CONSULTOR`

### 5.1 — Buscar cliente por CPF (ainda não existe)

```
GET {{BASE_URL}}/api/v1/clientes/documento/52998224725
Authorization: Bearer {{TOKEN_CONSULTOR}}
```
⚠️ Esperado: `404 Not Found` — cliente não cadastrado.

### 5.2 — Criar cliente (pessoa física)

```
POST {{BASE_URL}}/api/v1/clientes
Authorization: Bearer {{TOKEN_CONSULTOR}}
Content-Type: application/json
```
```json
{
  "nome": "Maria Aparecida Silva",
  "email": "maria@email.com",
  "telefone": "11987654321",
  "endereco": "Rua das Flores, 123 — São Paulo/SP",
  "tipoDoc": "CPF",
  "numeroDoc": "529.982.247-25"
}
```
✅ Salvar `data.id` → `ID_CLIENTE`

> O sistema aceita o CPF com ou sem máscara e armazena normalizado (somente dígitos).

### 5.3 — Buscar cliente criado por CPF (agora deve existir)

```
GET {{BASE_URL}}/api/v1/clientes/documento/52998224725
Authorization: Bearer {{TOKEN_CONSULTOR}}
```
✅ Esperado: `200 OK` com os dados do cliente.

### 5.4 — Listar clientes

```
GET {{BASE_URL}}/api/v1/clientes?pagina=1&porPagina=10
Authorization: Bearer {{TOKEN_CONSULTOR}}
```

### 5.5 — Buscar veículo por placa (ainda não existe)

```
GET {{BASE_URL}}/api/v1/veiculos/placa/BRA2E19
Authorization: Bearer {{TOKEN_CONSULTOR}}
```
⚠️ Esperado: `404 Not Found`.

### 5.6 — Criar veículo

```
POST {{BASE_URL}}/api/v1/veiculos
Authorization: Bearer {{TOKEN_CONSULTOR}}
Content-Type: application/json
```
```json
{
  "placa": "BRA-2E19",
  "renavam": "01234567890",
  "chassi": "9BWZZZ377VT004251",
  "marca": "Volkswagen",
  "modelo": "Golf 1.4 TSI",
  "ano": 2019,
  "cor": "Prata",
  "quilometragem": 62000
}
```
✅ Salvar `data.id` → `ID_VEICULO`

> Placa armazenada normalizada: `BRA2E19` (uppercase, sem traço).

### 5.7 — Atualizar quilometragem do veículo

```
PATCH {{BASE_URL}}/api/v1/veiculos/{{ID_VEICULO}}
Authorization: Bearer {{TOKEN_CONSULTOR}}
Content-Type: application/json
```
```json
{
  "quilometragem": 62350
}
```

**🔍 Prisma Studio — verificar tabelas `clientes` e `veiculos`:**
- `clientes`: `numeroDoc = "52998224725"` (sem máscara), `tipoDoc = "CPF"`
- `veiculos`: `placa = "BRA2E19"` (normalizada)
- Nenhuma FK direta entre `clientes` e `veiculos` (relação só existe via OS)

---

## Fase 6 — Fluxo Principal da OS (Happy Path com Diagnóstico)

```
RECEBIDA → ATRIBUIDA → EM_DIAGNOSTICO → AGUARDANDO_APROVACAO → APROVADA → EM_EXECUCAO → FINALIZADA → ENTREGUE
```

### 6.1 — Abrir OS

> **Token:** `TOKEN_CONSULTOR`

```
POST {{BASE_URL}}/api/v1/ordens-servico
Authorization: Bearer {{TOKEN_CONSULTOR}}
Content-Type: application/json
```
```json
{
  "clienteId": "{{ID_CLIENTE}}",
  "veiculoId": "{{ID_VEICULO}}",
  "problemasRelatados": [
    { "descricao": "Motor apresentando ruído metálico em aceleração" }
  ],
  "servicosSolicitados": [
    {
      "servicoId": "{{ID_SERVICO_TROCA_OLEO}}",
      "observacao": "Última troca há 12.000 km"
    }
  ],
  "notasInternas": "Cliente relatou que o ruído piora em temperaturas baixas",
  "notasCliente": "Veículo recebido com 62.350 km"
}
```
✅ Salvar `data.id` → `ID_OS`

Status esperado: `RECEBIDA`

**🔍 Prisma Studio — verificar:**
- `ordens_servico`: 1 registro, `status = "RECEBIDA"`, `numero` autoincremental
- `problemas_relatados`: 1 registro vinculado à OS
- `servicos_solicitados`: 1 registro com `servicoId`, `nomeServico = "Troca de Óleo do Motor"` (snapshot capturado)
- `historico_os`: 1 registro com evento `ORDEM_ABERTA`

### 6.2 — Atribuir mecânico

> **Token:** `TOKEN_CONSULTOR`

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS}}/atribuir/{{ID_USUARIO_MECANICO}}
Authorization: Bearer {{TOKEN_CONSULTOR}}
```

Status esperado: `ATRIBUIDA`

**🔍 Prisma Studio — `historico_os`:**
- Novo evento `MECANICO_ATRIBUIDO`, descrição: `"RECEBIDA → ATRIBUIDA | ..."`

### 6.3 — Registrar diagnóstico (opcional no fluxo)

> **Token:** `TOKEN_MECANICO`

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS}}/diagnostico
Authorization: Bearer {{TOKEN_MECANICO}}
Content-Type: application/json
```
```json
{
  "descricao": "Motor com desgaste nas bronzinas. Recomenda-se substituição das bronzinas de biela e verificação do comando de válvulas. Óleo com excesso de desgaste por abrasão — confirma necessidade de troca imediata."
}
```

Status esperado: `EM_DIAGNOSTICO`

**🔍 Prisma Studio — `diagnosticos`:**
- 1 registro com o texto de diagnóstico vinculado à OS

### 6.4 — Gerar orçamento

> **Token:** `TOKEN_MECANICO`

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS}}/orcamento
Authorization: Bearer {{TOKEN_MECANICO}}
Content-Type: application/json
```
```json
{
  "grupos": [
    {
      "titulo": "Troca de Óleo",
      "linhas": [
        {
          "tipo": "MATERIAL",
          "descricao": "Óleo Motor 5W30 1L",
          "quantidade": 4,
          "valorUnitario": 38.90,
          "pecaId": "{{ID_PECA_OLEO}}"
        },
        {
          "tipo": "MATERIAL",
          "descricao": "Filtro de Óleo Golf G6",
          "quantidade": 1,
          "valorUnitario": 48.50,
          "pecaId": "{{ID_PECA_FILTRO}}"
        },
        {
          "tipo": "SERVICO",
          "descricao": "Mão de obra — troca de óleo",
          "quantidade": 1,
          "valorUnitario": 80.00
        }
      ]
    },
    {
      "titulo": "Substituição de Bronzinas",
      "linhas": [
        {
          "tipo": "SERVICO",
          "descricao": "Mão de obra — desmontagem e montagem do motor",
          "quantidade": 1,
          "valorUnitario": 1200.00
        },
        {
          "tipo": "SERVICO",
          "descricao": "Mão de obra — verificação e ajuste do comando de válvulas",
          "quantidade": 1,
          "valorUnitario": 350.00
        }
      ]
    }
  ],
  "notasInternas": "Recomendar ao cliente troca preventiva das velas também",
  "notasCliente": "Orçamento inclui mão de obra de desmontagem e remontagem. Prazo estimado: 3 dias úteis."
}
```

Status esperado: `AGUARDANDO_APROVACAO`

Total esperado: `(4×38,90) + 48,50 + 80,00 + 1200,00 + 350,00 = R$ 1.834,10`

**🔍 Prisma Studio:**
- `orcamentos`: 1 registro com `notasInternas`, `notasCliente`, `aprovadoEm = null`
- `grupos_orcamento`: 2 registros (Troca de Óleo, Substituição de Bronzinas)
- `linhas_servico`: 5 registros distribuídos entre os grupos
- `historico_os`: evento `ORCAMENTO_GERADO`

### 6.5 — Buscar OS (verificar estado atual)

> **Token:** `TOKEN_CONSULTOR`

```
GET {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS}}
Authorization: Bearer {{TOKEN_CONSULTOR}}
```

### 6.6 — Aprovar orçamento

> **Token:** `TOKEN_CONSULTOR` (simulando aprovação em nome do cliente no balcão)

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS}}/aprovar
Authorization: Bearer {{TOKEN_CONSULTOR}}
```

Status esperado: `APROVADA`

**🔍 Prisma Studio — `orcamentos`:**
- `aprovadoEm` agora preenchido com o timestamp da aprovação

### 6.7 — Iniciar execução

> **Token:** `TOKEN_MECANICO`

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS}}/iniciar-execucao
Authorization: Bearer {{TOKEN_MECANICO}}
```

Status esperado: `EM_EXECUCAO`

### 6.8 — Registrar consumo de peças (baixa no estoque)

> **Token:** `TOKEN_MECANICO`

**Consumo do óleo (4 litros):**

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS}}/consumo-peca
Authorization: Bearer {{TOKEN_MECANICO}}
Content-Type: application/json
```
```json
{
  "pecaId": "{{ID_PECA_OLEO}}",
  "quantidade": 4
}
```

**Consumo do filtro (1 unidade):**

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS}}/consumo-peca
Authorization: Bearer {{TOKEN_MECANICO}}
Content-Type: application/json
```
```json
{
  "pecaId": "{{ID_PECA_FILTRO}}",
  "quantidade": 1
}
```

**🔍 Prisma Studio:**
- `consumos_peca`: 2 registros de consumo vinculados à OS
- `estoque`: óleo deve ter reduzido de 60 para 56; filtro de 20 para 19
- `historico_os`: 2 eventos `PECA_CONSUMIDA`

### 6.9 — Finalizar OS (conclusão técnica)

> **Token:** `TOKEN_MECANICO`

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS}}/finalizar
Authorization: Bearer {{TOKEN_MECANICO}}
```

Status esperado: `FINALIZADA`

### 6.10 — Entregar veículo

> **Token:** `TOKEN_CONSULTOR`

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS}}/entregar
Authorization: Bearer {{TOKEN_CONSULTOR}}
```

Status esperado: `ENTREGUE`

**🔍 Prisma Studio — `historico_os` da OS `{{ID_OS}}`:**

Deve conter os seguintes eventos em ordem cronológica:

| # | Evento | Status resultante |
|---|---|---|
| 1 | `ORDEM_ABERTA` | RECEBIDA |
| 2 | `MECANICO_ATRIBUIDO` | ATRIBUIDA |
| 3 | `DIAGNOSTICO_REGISTRADO` | EM_DIAGNOSTICO |
| 4 | `ORCAMENTO_GERADO` | AGUARDANDO_APROVACAO |
| 5 | `ORCAMENTO_APROVADO` | APROVADA |
| 6 | `EXECUCAO_INICIADA` | EM_EXECUCAO |
| 7 | `PECA_CONSUMIDA` | EM_EXECUCAO |
| 8 | `PECA_CONSUMIDA` | EM_EXECUCAO |
| 9 | `ORDEM_FINALIZADA` | FINALIZADA |
| 10 | `VEICULO_ENTREGUE` | ENTREGUE |

---

## Fase 7 — Fluxo Alternativo: Rejeição de Orçamento

> Cria uma nova OS para demonstrar o caminho de cancelamento.

### 7.1 — Abrir segunda OS (só serviço solicitado, sem diagnóstico)

> **Token:** `TOKEN_CONSULTOR`

```
POST {{BASE_URL}}/api/v1/ordens-servico
Authorization: Bearer {{TOKEN_CONSULTOR}}
Content-Type: application/json
```
```json
{
  "clienteId": "{{ID_CLIENTE}}",
  "veiculoId": "{{ID_VEICULO}}",
  "servicosSolicitados": [
    {
      "servicoId": "{{ID_SERVICO_ALINHAMENTO}}"
    }
  ]
}
```
> Salve o ID retornado como `ID_OS_2` para acompanhar este fluxo.

### 7.2 — Atribuir mecânico

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS_2}}/atribuir/{{ID_USUARIO_MECANICO}}
Authorization: Bearer {{TOKEN_CONSULTOR}}
```

> Status: `ATRIBUIDA` — sem diagnóstico, vai direto para orçamento.

### 7.3 — Gerar orçamento

> **Token:** `TOKEN_MECANICO`

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS_2}}/orcamento
Authorization: Bearer {{TOKEN_MECANICO}}
Content-Type: application/json
```
```json
{
  "grupos": [
    {
      "titulo": "Alinhamento e Balanceamento",
      "linhas": [
        {
          "tipo": "SERVICO",
          "descricao": "Alinhamento 3D + balanceamento 4 rodas",
          "quantidade": 1,
          "valorUnitario": 180.00
        }
      ]
    }
  ],
  "notasCliente": "Prazo: 2 horas."
}
```

Status: `AGUARDANDO_APROVACAO`

### 7.4 — Rejeitar orçamento

> **Token:** `TOKEN_CONSULTOR` (simulando recusa do cliente)

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS_2}}/rejeitar
Authorization: Bearer {{TOKEN_CONSULTOR}}
```

Status esperado: `CANCELADA`

**🔍 Prisma Studio — `orcamentos` da OS_2:**
- `rejeitadoEm` preenchido, `aprovadoEm = null`

**🔍 Prisma Studio — `historico_os` da OS_2:**
- `ORCAMENTO_REJEITADO` → CANCELADA
- OS permanece no banco para histórico; não é excluída

### 7.5 — Tentar avançar OS cancelada (deve falhar)

> Tentar iniciar execução de uma OS cancelada deve retornar erro 422:

```
PATCH {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS_2}}/iniciar-execucao
Authorization: Bearer {{TOKEN_MECANICO}}
```
⚠️ Esperado: `422 Unprocessable Entity` — regra de negócio impedindo transição inválida.

---

## Fase 8 — Consultas e Listagens

### 8.1 — Listar todas as OS (usuários internos)

```
GET {{BASE_URL}}/api/v1/ordens-servico?pagina=1&porPagina=10
Authorization: Bearer {{TOKEN_CONSULTOR}}
```

### 8.2 — Listar OS filtradas por status

```
GET {{BASE_URL}}/api/v1/ordens-servico?status=ENTREGUE&pagina=1&porPagina=10
Authorization: Bearer {{TOKEN_ADMIN}}
```

```
GET {{BASE_URL}}/api/v1/ordens-servico?status=CANCELADA&pagina=1&porPagina=10
Authorization: Bearer {{TOKEN_ADMIN}}
```

### 8.3 — Buscar OS específica

```
GET {{BASE_URL}}/api/v1/ordens-servico/{{ID_OS}}
Authorization: Bearer {{TOKEN_MECANICO}}
```

### 8.4 — Listar minhas OS (CLIENTE)

> ⚠️ **Nota de implementação:** o filtro usa o `usuarioId` (prefixo `us`) do token, mas a OS armazena o `clienteId` (prefixo `cl`). Para que este endpoint retorne a OS do cliente, o `clienteId` informado ao abrir a OS deve corresponder ao ID do usuário CLIENTE. Em uma integração completa, o frontend deve abrir a OS com o `clienteId` vinculado ao usuário CLIENTE autenticado.

```
GET {{BASE_URL}}/api/v1/ordens-servico/minhas/lista
Authorization: Bearer {{TOKEN_CLIENTE}}
```

---

## Fase 9 — Relatórios Analíticos

> **Token:** `TOKEN_ADMIN` ou `TOKEN_CONSULTOR`

### 9.1 — Lead-time das OS entregues

```
GET {{BASE_URL}}/api/v1/ordens-servico/relatorio/lead-time
Authorization: Bearer {{TOKEN_ADMIN}}
```

**Retorno esperado:**
```json
{
  "data": {
    "totalOSEntregues": 1,
    "leadTimeMedioHoras": ...,
    "leadTimeMinimoHoras": ...,
    "leadTimeMaximoHoras": ...,
    "ordens": [...]
  }
}
```

### 9.2 — KPIs pré-definidos

```
GET {{BASE_URL}}/api/v1/ordens-servico/relatorio/kpis
Authorization: Bearer {{TOKEN_ADMIN}}
```

Retorna 7 KPIs + taxa de aprovação de orçamento. Como só temos 1 OS entregue, todos os KPIs terão `totalAmostras = 1`.

### 9.3 — Tempo de ciclo personalizado

Tempo do mecânico (da atribuição até finalização, descontando aprovação do cliente):

```
GET {{BASE_URL}}/api/v1/ordens-servico/relatorio/tempo-ciclo?eventoInicio=MECANICO_ATRIBUIDO&eventoFim=ORDEM_FINALIZADA&descontar=ORCAMENTO_GERADO:ORCAMENTO_APROVADO
Authorization: Bearer {{TOKEN_ADMIN}}
```

Tempo bruto de execução (sem descontos):

```
GET {{BASE_URL}}/api/v1/ordens-servico/relatorio/tempo-ciclo?eventoInicio=EXECUCAO_INICIADA&eventoFim=ORDEM_FINALIZADA
Authorization: Bearer {{TOKEN_ADMIN}}
```

---

## Fase 10 — Auth: Refresh e Logout

### 10.1 — Renovar access token

> Usar o `refreshToken` retornado no login (não o accessToken).

```
POST {{BASE_URL}}/api/v1/auth/refresh
Authorization: Bearer <REFRESH_TOKEN_AQUI>
```

### 10.2 — Logout

```
POST {{BASE_URL}}/api/v1/auth/logout
Authorization: Bearer {{TOKEN_ADMIN}}
```
✅ Esperado: `204 No Content`

**🔍 Prisma Studio — `usuarios`:**
- `refreshTokenHash` do admin deve ser `null` após o logout

### 10.3 — Tentar usar refresh token após logout

> Usar o mesmo refreshToken que estava em uso antes do logout:

```
POST {{BASE_URL}}/api/v1/auth/refresh
Authorization: Bearer <MESMO_REFRESH_TOKEN_ANTERIOR>
```
⚠️ Esperado: `401 Unauthorized` — sessão revogada.

---

## Checklist de validações críticas via Prisma Studio

| Verificação | Tabela | O que conferir |
|---|---|---|
| Senha nunca em texto puro | `usuarios` | Campo `senhaHash` começa com `$2b$` (bcrypt) |
| Snapshot do serviço | `servicos_solicitados` | `nomeServico` preservado mesmo após renomear catálogo |
| Baixa no estoque | `estoque` | `quantidadeDisponivel` reduzida após consumo de peças |
| Histórico imutável | `historico_os` | Apenas INSERTs, nunca UPDATEs nas entradas |
| OS cancelada preservada | `ordens_servico` | OS_2 com `status = CANCELADA`, não excluída |
| IDs com prefixo correto | qualquer tabela | `os...`, `cl...`, `ve...`, `us...`, `pc...`, `sv...` |
| Timestamp de aprovação | `orcamentos` | `aprovadoEm` preenchido após aprovação |
| Notas do orçamento | `orcamentos` | `notasInternas` e `notasCliente` armazenadas separadamente |
| Grupos do orçamento | `grupos_orcamento` | Cada grupo tem `titulo` e FK para `orcamentoId` |
| Linhas por grupo | `linhas_servico` | FK para `grupoId`, não diretamente para `orcamentoId` |

---

## Referência rápida de endpoints

| Método | URL | Auth | Papéis |
|---|---|---|---|
| `POST` | `/api/v1/usuarios` | ❌ público | — |
| `GET` | `/api/v1/usuarios/:id` | ✅ JWT | qualquer |
| `POST` | `/api/v1/auth/login` | ❌ público | — |
| `POST` | `/api/v1/auth/refresh` | ✅ refresh token | — |
| `POST` | `/api/v1/auth/logout` | ✅ access token | — |
| `POST` | `/api/v1/servicos-oficina` | ✅ | ADMIN |
| `GET` | `/api/v1/servicos-oficina` | ✅ | ADMIN, CONSULTOR, MECANICO |
| `GET` | `/api/v1/servicos-oficina/:id` | ✅ | ADMIN, CONSULTOR, MECANICO |
| `PATCH` | `/api/v1/servicos-oficina/:id` | ✅ | ADMIN |
| `POST` | `/api/v1/clientes` | ✅ | qualquer autenticado |
| `GET` | `/api/v1/clientes` | ✅ | qualquer autenticado |
| `GET` | `/api/v1/clientes/documento/:doc` | ✅ | qualquer autenticado |
| `PATCH` | `/api/v1/clientes/:id` | ✅ | qualquer autenticado |
| `POST` | `/api/v1/veiculos` | ✅ | qualquer autenticado |
| `GET` | `/api/v1/veiculos` | ✅ | qualquer autenticado |
| `GET` | `/api/v1/veiculos/placa/:placa` | ✅ | qualquer autenticado |
| `PATCH` | `/api/v1/veiculos/:id` | ✅ | qualquer autenticado |
| `POST` | `/api/v1/estoque/pecas` | ✅ | ADMIN |
| `GET` | `/api/v1/estoque` | ✅ | ADMIN, MECANICO |
| `GET` | `/api/v1/estoque/pecas/:id` | ✅ | ADMIN, MECANICO |
| `PATCH` | `/api/v1/estoque/pecas/:id` | ✅ | ADMIN |
| `PATCH` | `/api/v1/estoque/pecas/:id/entrada` | ✅ | ADMIN |
| `POST` | `/api/v1/ordens-servico` | ✅ | ADMIN, CONSULTOR |
| `PATCH` | `/api/v1/ordens-servico/:id/atribuir/:mecanicoId` | ✅ | ADMIN, CONSULTOR |
| `PATCH` | `/api/v1/ordens-servico/:id/diagnostico` | ✅ | MECANICO |
| `PATCH` | `/api/v1/ordens-servico/:id/orcamento` | ✅ | MECANICO |
| `PATCH` | `/api/v1/ordens-servico/:id/aprovar` | ✅ | ADMIN, CONSULTOR, CLIENTE |
| `PATCH` | `/api/v1/ordens-servico/:id/rejeitar` | ✅ | ADMIN, CONSULTOR, CLIENTE |
| `PATCH` | `/api/v1/ordens-servico/:id/iniciar-execucao` | ✅ | MECANICO |
| `PATCH` | `/api/v1/ordens-servico/:id/consumo-peca` | ✅ | MECANICO |
| `PATCH` | `/api/v1/ordens-servico/:id/finalizar` | ✅ | MECANICO |
| `PATCH` | `/api/v1/ordens-servico/:id/entregar` | ✅ | ADMIN, CONSULTOR |
| `GET` | `/api/v1/ordens-servico` | ✅ | ADMIN, CONSULTOR, MECANICO |
| `GET` | `/api/v1/ordens-servico/:id` | ✅ | ADMIN, CONSULTOR, MECANICO |
| `GET` | `/api/v1/ordens-servico/minhas/lista` | ✅ | CLIENTE |
| `GET` | `/api/v1/ordens-servico/minhas/:id` | ✅ | CLIENTE |
| `GET` | `/api/v1/ordens-servico/relatorio/lead-time` | ✅ | ADMIN, CONSULTOR |
| `GET` | `/api/v1/ordens-servico/relatorio/kpis` | ✅ | ADMIN, CONSULTOR |
| `GET` | `/api/v1/ordens-servico/relatorio/tempo-ciclo` | ✅ | ADMIN, CONSULTOR |
