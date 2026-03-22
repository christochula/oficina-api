# Fluxos de Negócio — Sistema de Gestão de Oficina Mecânica

## 1. Objetivo do documento

Este documento descreve, em linguagem natural, os principais fluxos de negócio do sistema de gestão de uma oficina mecânica, desde a chegada do cliente com um veículo até a entrega do veículo após a execução dos serviços.

O objetivo é registrar de forma clara:

- os atores envolvidos em cada etapa
- as regras de negócio principais
- os estados da Ordem de Serviço
- os pontos de decisão do processo
- a relação entre o fluxo operacional e o modelo de domínio orientado a DDD

Este documento serve como base para:

- modelagem do domínio
- desenho da API
- definição de casos de uso
- implementação do backend em NestJS

---

## 2. Visão geral do processo

O processo de atendimento da oficina segue, de forma geral, as seguintes etapas:

1. identificação ou cadastro do cliente
2. identificação ou cadastro do veículo
3. abertura da Ordem de Serviço
4. atribuição da OS a um mecânico
5. diagnóstico técnico, quando necessário
6. geração e submissão do orçamento
7. aprovação ou rejeição do orçamento
8. execução dos serviços aprovados
9. finalização técnica da OS
10. entrega do veículo ao cliente

Nem toda Ordem de Serviço percorre exatamente o mesmo caminho. Existem variações importantes, por exemplo:

- OS com problema relatado e necessidade de diagnóstico
- OS com apenas serviço solicitado, sem diagnóstico
- OS com problema relatado e serviço solicitado ao mesmo tempo
- OS cancelada após rejeição do orçamento

---

## 3. Atores envolvidos

### Cliente
Pessoa física ou jurídica que solicita atendimento para um veículo.

### Consultor Técnico
Responsável pelo atendimento inicial, identificação do cliente e do veículo, abertura da OS, acompanhamento do processo e confirmação da entrega.

### Mecânico
Responsável pela execução técnica da OS, incluindo diagnóstico, execução dos serviços e conclusão técnica do atendimento.

### Sistema
Responsável por persistir dados, validar regras, executar buscas e controlar os estados da OS.

---

## 4. Fluxo 1 — Identificação e cadastro do cliente

### Objetivo
Garantir que o cliente esteja devidamente identificado no sistema antes da abertura de uma Ordem de Serviço.

### Tipos de cliente
O sistema suporta dois tipos de cliente:

- **Pessoa Física** — identificada por CPF
- **Pessoa Jurídica** — identificada por CNPJ (incluindo o novo formato alfanumérico vigente a partir de julho/2026)

O tipo de documento (`tipoDoc`) e o número do documento (`numeroDoc`) são informados no momento do cadastro e são imutáveis após a criação. A busca de cliente aceita ambos os formatos, com ou sem máscara.

### Pré-condições
- o cliente comparece à oficina solicitando atendimento
- o consultor técnico está autenticado no sistema

### Descrição do fluxo

1. O cliente informa seu número de documento (CPF ou CNPJ) ao consultor técnico.
2. O consultor técnico recebe o número de documento informado.
3. O consultor técnico consulta o cadastro de clientes no sistema.
4. O sistema executa a busca do cliente pelo número de documento.

### Decisão: cliente encontrado?

#### Caso A — Cliente encontrado
5. O sistema retorna o cadastro existente ao consultor técnico.
6. O consultor técnico pode atualizar os dados do cliente, se necessário.
7. O sistema salva as alterações.
8. O sistema confirma a atualização do cadastro.

Dados tipicamente atualizáveis:
- nome
- e-mail
- telefone
- endereço

#### Caso B — Cliente não encontrado
5. O sistema informa que não existe cliente com o número de documento informado.
6. O consultor técnico cria um novo cadastro de cliente.
7. O sistema salva o novo cadastro.
8. O sistema confirma a criação do cliente.

Dados mínimos do cadastro:
- tipo de documento (CPF ou CNPJ)
- número do documento
- nome completo
- e-mail
- telefone
- endereço

### Pós-condições
- o cliente está cadastrado ou atualizado
- o cliente está apto a abrir uma OS

### Regras de negócio
- o número de documento do cliente deve ser único no sistema
- o tipo e o número do documento são imutáveis após o cadastro
- o cliente deve existir antes da abertura de uma OS
- dados cadastrais podem ser atualizados pelo consultor técnico

### Observação de domínio
O cliente também pode existir como usuário externo do sistema para futuras funcionalidades, como consulta de OS e aprovação de orçamento, mas não possui permissão para alterar dados operacionais da oficina.

---

## 5. Fluxo 2 — Identificação e cadastro do veículo

### Objetivo
Garantir que o veículo esteja devidamente identificado no sistema antes da abertura da Ordem de Serviço.

### Pré-condições
- cliente identificado ou cadastrado
- consultor técnico autenticado

### Descrição do fluxo

9. O cliente informa a placa do veículo ao consultor técnico.
10. O consultor técnico recebe a placa.
11. O consultor técnico consulta o cadastro de veículos no sistema.
12. O sistema executa a busca do veículo pela placa.

### Decisão: veículo encontrado?

#### Caso A — Veículo encontrado
13. O sistema retorna o cadastro existente ao consultor técnico.
14. O consultor técnico pode atualizar os dados do veículo, se necessário.
15. O sistema salva as alterações.
16. O sistema confirma a atualização do cadastro.

Dados tipicamente atualizáveis:
- cor
- quilometragem atual

#### Caso B — Veículo não encontrado
13. O sistema informa que o veículo não foi encontrado.
14. O consultor técnico cria um novo cadastro de veículo.
15. O sistema salva o novo cadastro.
16. O sistema confirma a criação do veículo.

Dados mínimos do cadastro:
- placa
- marca
- modelo
- ano
- cor
- quilometragem

### Pós-condições
- o veículo está cadastrado ou atualizado
- o veículo está apto a ser vinculado a uma OS

### Regras de negócio
- a placa deve ser única no sistema
- o veículo deve existir antes da abertura da OS
- a quilometragem pode ser atualizada a cada atendimento
- o formato da placa deve ser validado

### Observação de domínio
Não existe relação estrutural direta entre Cliente e Veículo. A relação entre ambos ocorre exclusivamente por meio da Ordem de Serviço.

Essa decisão permite representar corretamente situações como:
- venda do veículo
- terceiros levando o veículo para atendimento
- veículos corporativos
- compartilhamento de uso do veículo

---

## 6. Fluxo 3 — Abertura da Ordem de Serviço

### Objetivo
Criar formalmente a Ordem de Serviço que representa a solicitação de atendimento para um cliente e um veículo.

### Pré-condições
- cliente identificado
- veículo identificado
- consultor técnico autenticado

### Descrição do fluxo

17. O cliente informa ao consultor técnico um ou mais problemas relatados e/ou um ou mais serviços solicitados.
18. O consultor técnico recebe as informações do cliente.
19. O consultor técnico abre a Ordem de Serviço no sistema.
20. O sistema salva a OS.
21. O sistema confirma a criação da OS.
22. O consultor técnico atribui a OS a um mecânico responsável.
23. O mecânico recebe a OS atribuída.

### Regras de negócio
- a OS deve estar vinculada a exatamente um cliente
- a OS deve estar vinculada a exatamente um veículo
- a OS não pode ser criada vazia
- deve existir pelo menos um problema relatado ou um serviço solicitado
- a OS deve ser atribuída a um mecânico para seguir o fluxo operacional

### Sobre problemas relatados e serviços solicitados

Uma OS pode conter:

#### Apenas problema relatado
Descrito em texto livre pelo cliente. Normalmente requer diagnóstico técnico.

Exemplo:
- "direção com folga"
- "terceira marcha não entra"

#### Apenas serviço solicitado
Selecionado a partir do catálogo de serviços da oficina (`ServicoOficina`). Pode ser acompanhado de uma observação livre do cliente.

Exemplo:
- serviço: Troca de óleo do motor — observação: "última troca há 10.000 km"
- serviço: Troca de fluido de arrefecimento

#### Ambos
Exemplo:
- problema relatado: "folga na direção"
- serviço solicitado: Troca de fluido de arrefecimento

### Seleção de serviços do catálogo
O consultor técnico seleciona os serviços solicitados pelo cliente a partir do catálogo `ServicoOficina`, gerenciado pelo administrador. O sistema valida que o `servicoId` existe no catálogo e captura um snapshot do nome (`nomeServico`) no momento da abertura — preservando o registro histórico mesmo que o catálogo seja alterado depois.

### Pós-condições
- a OS foi criada
- a OS está atribuída a um mecânico
- a OS está pronta para diagnóstico ou evolução direta para orçamento

### Estados envolvidos
- **RECEBIDA**: status inicial da OS após sua criação
- **ATRIBUIDA**: status após designação do mecânico responsável

### Observação importante
Não foi modelado o estado **RASCUNHO** no MVP, porque o domínio atual não possui fluxo de persistência parcial ou edição posterior antes da abertura efetiva da OS.

---

## 7. Fluxo 4 — Diagnóstico e geração de orçamento

### Objetivo
Definir o escopo técnico e financeiro da execução do serviço.

### Pré-condições
- OS existente e atribuída
- mecânico responsável identificado

### Descrição do fluxo

24. O mecânico recebe a OS atribuída.
25. O mecânico avalia o conteúdo da OS.

### Decisão: existe problema relatado que exige análise técnica?

#### Caso A — Há necessidade de diagnóstico
26. A OS evolui para **EM_DIAGNOSTICO**.
27. O mecânico realiza a análise técnica do veículo.
28. O mecânico registra o diagnóstico na OS.
29. Com base no diagnóstico, o sistema permite a composição do orçamento.

#### Caso B — Não há necessidade de diagnóstico
26. A OS não entra em diagnóstico.
27. O orçamento é montado diretamente com base nos serviços solicitados.

### Composição do orçamento
O orçamento é estruturado em **grupos temáticos** (`GrupoOrcamento`), cada um com título livre definido pelo mecânico e um conjunto de linhas de serviço.

#### Estrutura do orçamento

```
Orçamento
  └─ Grupo: "Retífica do Motor"
       ├─ Linha MATERIAL: Junta do cabeçote × 1 — R$ 350,00
       ├─ Linha MATERIAL: Óleo 5W30 (1L) × 4 — R$ 40,00/un
       └─ Linha SERVICO: Mão de obra retífica × 1 — R$ 800,00
  └─ Grupo: "Troca de Óleo"
       ├─ Linha MATERIAL: Filtro de óleo × 1 — R$ 45,00
       └─ Linha SERVICO: Troca de óleo × 1 — R$ 60,00
```

O mecânico define os títulos dos grupos livremente para organizar o orçamento de forma legível ao cliente.

Cada linha de serviço possui:
- tipo (`MATERIAL` ou `SERVICO`)
- descrição
- quantidade
- valor unitário
- subtotal (quantidade × valor unitário)

O total de cada grupo é a soma dos subtotais de suas linhas.
O total do orçamento é a soma dos totais de todos os grupos.

#### Linha do tipo MATERIAL
Representa consumo de peça ou item físico.

Exemplos:
- óleo 5W30
- filtro de óleo
- pastilha de freio

Características:
- pode referenciar uma peça do estoque (`pecaId`)
- afeta estoque quando consumida

#### Linha do tipo SERVICO
Representa mão de obra ou atividade técnica executada pela oficina.

Exemplos:
- troca de óleo
- alinhamento
- diagnóstico eletrônico

Características:
- não referencia peça
- não afeta estoque diretamente

### Notas do orçamento
O mecânico pode incluir duas categorias de notas ao gerar o orçamento:
- **notasInternas**: observações da equipe da oficina — não visíveis ao cliente
- **notasCliente**: notas enviadas ao cliente junto com o orçamento

### Regras de negócio
- o orçamento deve conter ao menos um grupo
- cada grupo deve conter ao menos uma linha de serviço
- linha MATERIAL pode referenciar uma peça do estoque (`pecaId`)
- linha SERVICO não deve exigir peça associada
- o orçamento pertence à OS e não existe isoladamente no fluxo do MVP

### Pós-condições
- a OS possui orçamento montado
- a OS está pronta para submissão ao cliente

### Estados envolvidos
- **EM_DIAGNOSTICO**: quando existe análise técnica a ser realizada
- **AGUARDANDO_APROVACAO**: após orçamento gerado e pendente de decisão do cliente

---

## 8. Fluxo 5 — Aprovação ou rejeição do orçamento

### Objetivo
Permitir que o cliente autorize ou recuse a execução dos serviços orçados.

### Pré-condições
- OS com orçamento gerado
- orçamento apresentado ao cliente

### Descrição do fluxo

30. O orçamento é apresentado ao cliente.
31. O cliente avalia o orçamento.

### Decisão: cliente aprova o orçamento?

#### Caso A — Orçamento aprovado
32. O cliente aprova o orçamento.
33. O sistema registra a aprovação.
34. A OS evolui para **APROVADA**.

#### Caso B — Orçamento rejeitado
32. O cliente rejeita o orçamento.
33. O sistema registra a rejeição.
34. A OS evolui para **CANCELADA**.

### Regras de negócio
- somente OS com orçamento pode ser aprovada ou rejeitada
- uma OS cancelada não retorna ao fluxo operacional normal
- a rejeição do orçamento encerra o atendimento operacional da OS

### Pós-condições

#### Se aprovado
- a OS está apta a ser executada

#### Se rejeitado
- a OS está cancelada

### Estado alternativo
Pode existir uma retenção administrativa da OS cancelada por alguns dias para fins de consulta, mas isso não altera o encerramento do fluxo operacional.

---

## 9. Fluxo 6 — Execução do serviço

### Objetivo
Executar os serviços aprovados e registrar o resultado técnico da OS.

### Pré-condições
- OS aprovada
- mecânico responsável definido

### Descrição do fluxo

35. O mecânico inicia a execução da OS.
36. O sistema altera o status para **EM_EXECUCAO**.
37. O mecânico executa os serviços previstos.
38. O sistema registra o consumo de peças e a execução das linhas de serviço.
39. O mecânico conclui tecnicamente o atendimento.
40. O sistema altera o status da OS para **FINALIZADA**.

### Regras de negócio
- a execução só pode começar após aprovação do orçamento
- o consumo de peça deve refletir no estoque
- o histórico da OS deve registrar eventos relevantes da execução
- após a finalização técnica, a OS não retorna às etapas anteriores do fluxo normal

### Pós-condições
- os serviços foram tecnicamente concluídos
- o veículo está pronto para retirada

### Estados envolvidos
- **EM_EXECUCAO**
- **FINALIZADA**

---

## 10. Fluxo 7 — Entrega do veículo

### Objetivo
Registrar a retirada do veículo pelo cliente e concluir o ciclo operacional da OS.

### Pré-condições
- OS finalizada
- veículo pronto para retirada

### Descrição do fluxo

41. O sistema ou o consultor técnico notifica o cliente de que o veículo está pronto.
42. O cliente comparece à oficina para retirar o veículo.
43. O consultor técnico confirma a entrega do veículo.
44. O sistema altera o status da OS para **ENTREGUE**.

### Regras de negócio
- apenas OS finalizada pode ser entregue
- após a entrega, a OS não pode mais ser alterada no fluxo operacional
- a entrega deve ser registrada explicitamente

### Pós-condições
- o veículo foi entregue ao cliente
- a OS concluiu seu ciclo operacional

### Estados envolvidos
- **FINALIZADA**
- **ENTREGUE**

### Observação importante
No MVP, o estado **ENCERRADA** não é necessário. O status **ENTREGUE** já representa adequadamente o fim do fluxo operacional. Um estado adicional de encerramento administrativo só faria sentido quando existirem processos complementares, como faturamento, emissão de nota fiscal, fechamento financeiro ou pós-atendimento.

---

## 11. Fluxo 8 — Gestão do Catálogo de Serviços

### Objetivo
Manter o catálogo de serviços padrão da oficina (`ServicoOficina`), utilizado pelo consultor técnico ao abrir uma OS com serviços solicitados.

### Ator principal
Administrador

### Descrição do fluxo

O administrador pode:

1. **Registrar um novo serviço** — informa nome e, opcionalmente, descrição. O sistema cria o serviço como ativo.
2. **Listar serviços** — visualiza todos os serviços do catálogo (ativos e inativos).
3. **Atualizar um serviço** — edita nome, descrição ou status ativo/inativo.
4. **Desativar um serviço** — marca como inativo, impedindo novas seleções. OS históricas preservam o snapshot do nome.

### Regras de negócio
- Somente `ADMINISTRADOR` pode criar ou atualizar serviços do catálogo
- Usuários internos (`CONSULTOR_TECNICO`, `MECANICO`) podem listar e consultar serviços
- A desativação não exclui o serviço — preserva integridade referencial com OS históricas
- Não há preço base no catálogo — o preço é definido pelo mecânico no orçamento

### Endpoints da API
- `POST /api/v1/servicos-oficina` — registrar serviço (ADMIN)
- `GET /api/v1/servicos-oficina` — listar serviços (usuários internos)
- `GET /api/v1/servicos-oficina/:id` — buscar serviço por ID (usuários internos)
- `PATCH /api/v1/servicos-oficina/:id` — atualizar serviço (ADMIN)

---

## 12. Consolidação dos estados da Ordem de Serviço

### Fluxo principal
- RECEBIDA
- ATRIBUIDA
- EM_DIAGNOSTICO (opcional)
- AGUARDANDO_APROVACAO
- APROVADA
- EM_EXECUCAO
- FINALIZADA
- ENTREGUE

### Fluxo alternativo
- CANCELADA

---

## 13. Regras globais do processo

- cliente e veículo devem existir antes da criação da OS
- cliente e veículo não possuem relação estrutural direta
- a OS é o ponto de vínculo entre cliente e veículo
- a OS deve possuir ao menos um problema relatado ou um serviço solicitado
- diagnóstico é opcional
- orçamento é obrigatório antes da execução
- execução depende de aprovação do cliente
- entrega só pode ocorrer após finalização técnica
- o ciclo operacional termina em ENTREGUE ou CANCELADA
- o cliente pode ser pessoa física (CPF) ou pessoa jurídica (CNPJ); o número de documento é único e imutável

---

## 14. Relação com o modelo de domínio (DDD)

### Aggregate Roots principais
- Cliente
- Veiculo
- OrdemServico
- Estoque
- ServicoOficina

`Peca` é uma entidade interna do aggregate `Estoque`, não um aggregate root independente.
`ServicoOficina` é o catálogo de serviços — aggregate simples gerenciado pelo administrador.

### Aggregate Root central do sistema
**OrdemServico**

A OrdemServico concentra o fluxo principal do negócio e encapsula:

- clienteId
- veiculoId
- mecanicoResponsavelId
- problemas relatados
- serviços solicitados
- diagnóstico
- orçamento
- linhas de serviço
- histórico
- status

### Observação sobre o orçamento
No MVP, o orçamento é tratado como parte da OrdemServico, e não como aggregate separado.

Isso simplifica:
- modelagem
- persistência
- transações
- implementação do backend

---

## 15. Possíveis casos de uso derivados

**Catálogo de Serviços (ServicoOficina):**
- RegistrarServicoOficina
- ListarServicosOficina
- BuscarServicoOficinaPorId
- AtualizarServicoOficina

**Clientes:**
- BuscarClientePorNumeroDoc
- CriarCliente
- AtualizarCliente
- ListarClientes

**Veículos:**
- BuscarVeiculoPorPlaca
- CriarVeiculo
- AtualizarVeiculo
- ListarVeiculos

**Ordens de Serviço:**
- AbrirOrdemServico
- AtribuirOrdemServico
- RegistrarDiagnostico
- GerarOrcamento
- AprovarOrcamento
- RejeitarOrcamento
- IniciarExecucao
- RegistrarConsumoPeca
- FinalizarOrdemServico
- EntregarVeiculo

**Análise operacional:**
- RelatorioLeadTime
- KpisOrdemServico
- TempoCicloPersonalizado

---

## 16. Rastreabilidade e Histórico

Cada transição de estado da OS gera automaticamente uma entrada no histórico com:
- o evento ocorrido (ex: `MECANICO_ATRIBUIDO`)
- `statusAnterior`: status tipado antes da transição (null apenas em `ORDEM_ABERTA`)
- `statusNovo`: status tipado resultante da transição
- `descricao`: texto human-readable `"STATUS_ANTERIOR → STATUS_NOVO | detalhe"`
- o identificador do usuário que executou a ação
- o timestamp preciso do evento

Essa rastreabilidade permite auditar o ciclo completo de qualquer OS e alimentar relatórios operacionais.

---

## 17. Relatório de Lead-time

Após a entrega do veículo, o sistema permite gerar um relatório de lead-time que calcula o tempo médio de atendimento das OS entregues.

O lead-time é medido da abertura da OS (`RECEBIDA`) até o registro de entrega do veículo (`ENTREGUE`), com base no timestamp do evento `VEICULO_ENTREGUE` no histórico.

O relatório é acessível a administradores e consultores técnicos.

---

## 18. Fechamento

Os fluxos aqui descritos formam a espinha dorsal funcional do sistema da oficina mecânica e servem como referência direta para o desenho da API, para a implementação dos casos de uso e para a definição das regras centrais do domínio.

A principal decisão de modelagem é tratar a Ordem de Serviço como o centro do processo, concentrando nela a ligação entre cliente, veículo, diagnóstico, orçamento, execução e entrega.
