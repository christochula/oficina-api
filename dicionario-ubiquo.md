# Dicionario Ubiquo v3
## Sistema de Gestao de Oficina Mecanica

Este documento registra os termos que melhor descrevem o dominio e a implementacao atual do repositorio.

---

## 1. Organizacao

### Oficina

Empresa responsavel por diagnosticar, orcar, executar e entregar servicos em veiculos.

---

## 2. Atores do dominio

### Cliente

Pessoa fisica ou juridica atendida pela oficina.

No modelo atual, `Cliente` e um aggregate proprio com:

- `id`
- `tipoDoc`
- `numeroDoc`
- `nome`
- `email`
- `telefone`
- endereco
- `ativo`
- `usuarioId` opcional

`usuarioId` liga o cliente de negocio a um `Usuario` autenticavel com papel `CLIENTE`.

### Usuario

Identidade de autenticacao do sistema.

Todo usuario possui:

- `id`
- `nome`
- `email`
- `senhaHash`
- `papel`
- `ativo`
- `refreshTokenHash`

### Admin seed

Usuario `ADMINISTRADOR` criado pelo script `prisma/seed.ts` para resolver o bootstrap do sistema. Como `POST /api/v1/usuarios` exige papel `ADMINISTRADOR`, o primeiro admin precisa ser inserido diretamente no banco via `npm run seed`.

### Usuario interno

Usuario que opera a oficina.

Papeis internos atuais:

- `ADMINISTRADOR`
- `CONSULTOR_TECNICO`
- `MECANICO`

### Usuario externo

Usuario com papel `CLIENTE`, autenticado via JWT.

No estado atual:

- um `Usuario CLIENTE` pode estar vinculado a no maximo um `Cliente`
- esse vinculo e persistido em `Cliente.usuarioId`
- as rotas de ownership do cliente resolvem primeiro esse vinculo antes de consultar ou decidir sobre a OS

### Cliente autenticado

Usuario externo que possui:

- papel `CLIENTE`
- vinculo para um `Cliente` ativo

Sem esse vinculo, ele autentica, mas nao consegue acessar as rotas de ownership da OS.

---

## 3. Papeis operacionais

### Administrador

Papel com acesso administrativo ao sistema.

Pode:

- criar usuarios
- manter catalogo de servicos
- operar estoque
- consultar OS internamente
- entregar veiculo

### Consultor Tecnico

Responsavel pelo atendimento de balcao.

Pode:

- cadastrar e atualizar clientes
- cadastrar e atualizar veiculos
- abrir OS
- atribuir mecanico
- consultar OS internamente
- consultar relatorios operacionais
- entregar veiculo

### Mecanico

Responsavel pela execucao tecnica.

Pode:

- listar apenas suas OS em andamento
- buscar uma OS em que e o responsavel
- registrar diagnostico
- gerar orcamento
- iniciar execucao
- registrar consumo de peca
- finalizar OS
- consultar estoque
- consultar catalogo de servicos

### Cliente autenticado

Papel externo que pode:

- listar suas proprias OS
- buscar uma OS propria por ID
- aprovar o proprio orcamento
- rejeitar o proprio orcamento

Sempre com validacao de ownership.

---

## 4. Aggregates e entidades

### OrdemServico

Aggregate central do sistema.

Conecta:

- `clienteId`
- `veiculoId`
- `mecanicoResponsavelId`
- problemas relatados
- servicos solicitados
- diagnostico
- orcamento
- consumos de peca
- historico
- status

### Cliente

Aggregate que representa o atendido da oficina.

Identificadores relevantes:

- `id` tecnico com prefixo `cl`
- `tipoDoc` + `numeroDoc` como identidade de negocio
- `usuarioId` opcional para ownership autenticado

`tipoDoc` e `numeroDoc` sao imutaveis apos o cadastro.

### Veiculo

Aggregate do veiculo atendido.

O relacionamento com `Cliente` nao e direto; acontece via `OrdemServico`.

### Usuario

Aggregate de acesso e autenticacao.

Nao substitui o aggregate `Cliente`, mas pode ser vinculado a ele quando o papel e `CLIENTE`.

### Estoque

Aggregate root do inventario.

Controla:

- saldo disponivel
- quantidade minima
- entrada de peca
- saida por consumo

### Peca

Entidade interna do aggregate `Estoque`.

### ServicoOficina

Aggregate do catalogo de servicos padrao.

Campos atuais:

- `nome`
- `descricao`
- `categoria`
- `ativo`

Observacao:

- a API lista apenas servicos ativos
- ainda nao ha endpoint de desativacao/delete

---

## 5. Termos do atendimento

### ProblemaRelatado

Descricao livre do problema percebido pelo cliente.

### ServicoSolicitado

Servico selecionado do catalogo `ServicoOficina` no momento da abertura da OS.

Persistido com:

- `servicoId`
- `nomeServico` em snapshot
- `observacao`

### Diagnostico

Resultado tecnico da analise do mecanico.

No fluxo atual:

- pode ser opcional
- quando a OS esta `ATRIBUIDA`, o caso de uso entra em `EM_DIAGNOSTICO` antes de gravar o diagnostico

### Orcamento

Composicao financeira da OS.

Pertence a `OrdemServico`.

Campos relevantes:

- `total`
- `notasInternas`
- `notasCliente`
- `aprovadoEm`
- `rejeitadoEm`

### GrupoOrcamento

Agrupamento tematico de linhas dentro do orcamento.

### LinhaServico

Item individual do orcamento.

Campos:

- `tipo`
- `descricao`
- `quantidade`
- `valorUnitario`
- `subtotal`
- `pecaId` opcional

Tipos atuais:

- `MATERIAL`
- `SERVICO`

### ConsumoPeca

Registro de uso de uma peca em uma OS.

No estado atual:

- a OS registra o consumo e gera evento de dominio
- o caso de uso processa o evento
- estoque e OS sao persistidos na mesma transacao de banco

### Ownership do cliente

Regra que garante que um `CLIENTE` autenticado so pode:

- listar suas OS
- buscar sua OS por ID
- aprovar seu proprio orcamento
- rejeitar seu proprio orcamento

Ownership hoje significa:

- o usuario autenticado e resolvido para um `Cliente` via `Cliente.usuarioId`
- o `clienteId` da OS precisa coincidir com esse `Cliente.id`

---

## 6. Historico e status

### HistoricoOS

Registro cronologico de eventos da OS.

Cada entrada guarda:

- `evento`
- `descricao`
- `usuarioId`
- `statusAnterior`
- `statusNovo`
- `criadoEm`

### EventoHistoricoOS

Enum atual:

- `ORDEM_ABERTA`
- `MECANICO_ATRIBUIDO`
- `DIAGNOSTICO_REGISTRADO`
- `ORCAMENTO_GERADO`
- `ORCAMENTO_APROVADO`
- `ORCAMENTO_REJEITADO`
- `EXECUCAO_INICIADA`
- `PECA_CONSUMIDA`
- `ORDEM_FINALIZADA`
- `VEICULO_ENTREGUE`
- `ORDEM_CANCELADA`

### StatusOrdemServico

Estados atuais:

- `RECEBIDA`
- `ATRIBUIDA`
- `EM_DIAGNOSTICO`
- `AGUARDANDO_APROVACAO`
- `APROVADA`
- `EM_EXECUCAO`
- `FINALIZADA`
- `ENTREGUE`
- `CANCELADA`

---

## 7. Termos de autenticacao

### Access token

JWT de curta duracao usado nas rotas protegidas.

### Refresh token

JWT de longa duracao usado em `POST /api/v1/auth/refresh`.

O valor bruto nao e persistido; o sistema salva apenas `refreshTokenHash`.

### Usuario inativo

Usuario com `ativo = false`.

No estado atual:

- nao consegue fazer login
- nao consegue renovar sessao
- nao consegue autenticar requests protegidas, mesmo com token ainda valido

---

## 8. Termos analiticos

### Lead-time

Tempo entre `criadoEm` da OS e o timestamp do evento `VEICULO_ENTREGUE`.

### KPI

Indicador calculado a partir do historico das OS.

### Tempo de ciclo personalizado

Intervalo entre dois eventos quaisquer do historico, com descontos opcionais.

---

## 9. Convencoes de linguagem

No codigo atual, a linguagem principal do dominio continua sendo portugues brasileiro:

- nomes de classes
- nomes de casos de uso
- enums de dominio
- eventos
- contratos de repositorio

Prisma nao deve vazar para a camada de dominio; os repositorios fazem o mapeamento.
