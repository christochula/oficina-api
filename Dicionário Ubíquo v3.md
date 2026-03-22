# Dicionário Ubíquo  
## Sistema de Gestão de Oficina Mecânica

Este documento define a linguagem ubíqua utilizada no desenvolvimento do sistema de gestão da oficina mecânica.

A linguagem ubíqua estabelece um vocabulário comum entre especialistas do domínio e desenvolvedores, garantindo consistência na comunicação, na modelagem do domínio e na implementação do sistema.

Todos os termos aqui definidos devem ser utilizados de forma consistente em:

- documentação do sistema
- comunicação entre equipe técnica e especialistas do domínio
- modelagem de domínio
- implementação do backend
- APIs do sistema

---

# 1. Organização

## Oficina
Empresa responsável pela execução de serviços de manutenção, diagnóstico e reparo em veículos.

A oficina é a organização operadora do sistema e responsável pela execução das ordens de serviço.

---

# 2. Atores do Domínio

## Cliente
Pessoa física ou jurídica que solicita serviços para um veículo na oficina.

O cliente representa o responsável pela solicitação do atendimento, podendo ou não ser o proprietário do veículo.

Responsabilidades do cliente no processo:

- relatar problemas percebidos no veículo
- solicitar serviços específicos
- aprovar ou recusar orçamentos
- retirar o veículo após conclusão dos serviços

Um cliente pode possuir múltiplas ordens de serviço registradas ao longo do tempo.

---

## Usuário
Representação digital de uma pessoa que possui acesso ao sistema.

Todo usuário possui:

- credenciais de acesso
- um papel de usuário
- permissões associadas ao papel

---

## Usuário Interno
Usuário que representa um colaborador da oficina.

Exemplos:

- consultor técnico
- mecânico
- administrador

---

## Usuário Externo
Usuário associado a um cliente que pode interagir com funcionalidades externas do sistema.

Exemplos:

- consultar status da ordem de serviço
- aprovar orçamento

---

## Papel de Usuário
Classificação atribuída a um usuário para definir suas permissões dentro do sistema.

Exemplos:

- Administrador
- Consultor Técnico
- Mecânico
- Cliente

---

## Implementação de Papel de Usuário

Os papéis de usuário são implementados como uma enumeração no sistema:

| Valor             | Descrição                                                        |
|-------------------|------------------------------------------------------------------|
| ADMINISTRADOR     | Acesso total ao sistema                                          |
| CONSULTOR_TECNICO | Abertura e acompanhamento de ordens de serviço                   |
| MECANICO          | Execução técnica de ordens de serviço                            |
| CLIENTE           | Acesso externo limitado: consulta de OS e aprovação de orçamento |

Consultor Técnico e Mecânico são papéis operacionais representados por este enum.
Não são entidades separadas do domínio — são UsuarioInterno com papéis distintos.

---

# 3. Papéis Operacionais

## Consultor Técnico
Funcionário da oficina responsável pelo atendimento inicial ao cliente.

Responsabilidades:

- recepcionar o cliente
- registrar a descrição do problema
- registrar serviços solicitados
- abrir ordens de serviço
- acompanhar o fluxo da ordem de serviço

---

## Mecânico
Funcionário da oficina responsável pela execução técnica dos serviços.

Responsabilidades:

- realizar diagnóstico técnico
- executar reparos
- registrar serviços executados
- registrar peças utilizadas
- atualizar o status da ordem de serviço

---

## Mecânico Responsável
UsuarioInterno com papel MECANICO designado para executar uma OrdemServico específica.

Não é uma entidade independente. É representado na OrdemServico como uma referência
ao identificador do UsuarioInterno designado.

Regra de negócio: somente usuários com papel MECANICO podem ser designados como
mecânico responsável. Esta validação é responsabilidade do aggregate OrdemServico
no momento da atribuição.

---

# 4. Entidades de Domínio

## Cliente
Entidade que representa quem solicita serviços para um veículo. Pode ser pessoa física (identificada por CPF) ou pessoa jurídica (identificada por CNPJ).

O tipo de documento (`tipoDoc`) e o número do documento (`numeroDoc`) são o identificador de negócio do cliente — únicos no sistema e imutáveis após o cadastro.

Um cliente pode abrir múltiplas ordens de serviço ao longo do tempo.

---

## Veículo
Entidade que representa um veículo que pode ser atendido pela oficina.

O sistema não estabelece vínculo permanente entre cliente e veículo.  
O relacionamento entre cliente e veículo ocorre exclusivamente através das ordens de serviço registradas.

Essa abordagem reflete situações comuns no domínio real:

- venda do veículo para outro proprietário
- familiares trazendo veículos de terceiros
- empresas trazendo veículos corporativos
- amigos levando veículos para manutenção

Identificação do veículo:

- placa
- RENAVAM
- chassi

Atributos adicionais:

- marca
- modelo
- ano

---

## Ordem de Serviço (OS)
Registro formal que representa a solicitação de diagnóstico ou execução de serviços para um veículo.

A ordem de serviço é o elemento central do domínio, conectando:

- cliente que solicitou o atendimento
- veículo atendido
- problemas relatados
- serviços solicitados
- diagnóstico técnico
- orçamento
- serviços executados
- peças utilizadas
- histórico de eventos

A ordem de serviço possui um ciclo de vida controlado por estados.

Além dos dados operacionais, a OS suporta dois campos de notas opcionais:
- `notasInternas`: notas internas da equipe da oficina (não visíveis ao cliente)
- `notasCliente`: notas visíveis ao cliente durante o atendimento

---

# 5. Relacionamentos do Domínio

O relacionamento entre as entidades principais ocorre da seguinte forma:

Cliente 1 ── N OrdemServico  
Veiculo 1 ── N OrdemServico  

Isso significa que:

- um cliente pode abrir várias ordens de serviço
- um veículo pode possuir várias ordens de serviço ao longo do tempo
- cada ordem de serviço está associada a exatamente um cliente e um veículo

O histórico de atendimento do veículo é determinado pelas ordens de serviço associadas a ele.

---

# 6. Problemas e Serviços

## Problema Relatado
Relato fornecido pelo cliente descrevendo comportamento anormal percebido no veículo.

Exemplos:

- direção com folga
- ruído no motor
- marcha não engata

Um problema relatado normalmente exige diagnóstico técnico.

---

## Serviço Solicitado
Serviço específico solicitado diretamente pelo cliente, selecionado a partir do catálogo de serviços da oficina (`ServicoOficina`).

Ao abrir a OS, o consultor seleciona o serviço pelo seu ID no catálogo. O sistema captura um snapshot do nome do serviço (`nomeServico`) no momento da abertura — esse snapshot é preservado mesmo que o catálogo seja alterado posteriormente.

O campo `observacao` é opcional e permite que o cliente adicione contexto ao serviço solicitado (ex: "última troca há 10.000 km").

Um serviço solicitado pode ser executado sem necessidade de diagnóstico prévio.

---

## Serviço da Oficina (ServicoOficina)
Entrada do catálogo de serviços mantido pela oficina.

Representa um serviço padronizado que pode ser solicitado pelo cliente ao abrir uma OS.

Atributos:
- `nome`: nome canônico do serviço no catálogo
- `descricao`: texto opcional com mais detalhes
- `ativo`: indica se o serviço está disponível para seleção

Regras:
- Não possui preço base — o preço é definido pelo mecânico no momento do orçamento
- Pode ser desativado sem excluir dados históricos
- Gerenciado exclusivamente pelo `ADMINISTRADOR`

---

# 7. Diagnóstico

## Diagnóstico
Resultado da análise técnica realizada pela oficina para identificar a causa de um problema relatado.

O diagnóstico pode indicar:

- defeitos encontrados
- peças que precisam ser substituídas
- serviços necessários

O diagnóstico pode resultar na criação de um orçamento.

---

# 8. Orçamento

## Orçamento
Estimativa financeira necessária para execução dos serviços identificados no diagnóstico ou solicitados pelo cliente.

O orçamento deve ser aprovado pelo cliente antes do início da execução dos serviços.

O orçamento é estruturado em grupos temáticos (`GrupoOrcamento`), cada um com um título livre definido pelo mecânico e um conjunto de linhas de serviço.

O orçamento também pode conter:
- `notasInternas`: notas da equipe interna — não visíveis ao cliente
- `notasCliente`: notas enviadas ao cliente junto com o orçamento

---

## Grupo de Orçamento (GrupoOrcamento)
Agrupamento temático de linhas de serviço dentro de um orçamento.

O mecânico organiza o orçamento em grupos com título livre, permitindo separar serviços distintos de forma legível.

Exemplos de grupos:
- "Retífica do Motor"
- "Troca de Óleo"
- "Retífica dos Discos de Freio"

Cada grupo contém ao menos uma linha de serviço. O total do orçamento é a soma dos totais de todos os grupos.

---

## Linha de Serviço

Item individual que compõe um grupo de orçamento.

Uma linha de serviço representa um material ou um serviço executado.

Cada linha de serviço possui:

    Descrição

    Quantidade

    Valor unitário

    Subtotal

Uma linha de serviço possui um tipo, que determina seu comportamento no domínio.

Tipos possíveis de linha de serviço:

    Material
    Serviço

---

## Material

Linha de serviço que representa o consumo de uma peça do estoque.

Características:
    possui peça associada
    consome estoque
    possui quantidade física

Exemplos:
    Oleo Motor 5W30 (1L)
    Filtro de óleo X
    Pastilha de freio Y

---

## Serviço

Linha de serviço que representa trabalho executado pela oficina.

Características:
    não possui peça associada
    não consome estoque
    representa atividade técnica

Exemplos:
    Troca de óleo
    Alinhamento
    Diagnóstico eletrônico

---

# 9. Peças e Estoque

## Peça
Componente físico utilizado na manutenção ou reparo de veículos.

Atributos comuns:

- código
- nome
- descrição
- preço de venda

---

## Estoque
Registro da quantidade disponível de peças na oficina.

Responsável por controlar:

- entrada de peças
- saída de peças
- consumo em ordens de serviço

---

## Consumo de Peça
Registro da utilização de uma peça do estoque em uma ordem de serviço.

O consumo é representado como um evento de domínio disparado pela OrdemServico.
O Estoque é responsável por processar este evento e reduzir a quantidade disponível da peça.

---

# 10. Processos de Negócio

## Busca de Cliente por Número de Documento
Processo de localizar um cliente no sistema a partir do seu número de documento (CPF ou CNPJ).

O número de documento pode ser informado com ou sem máscara — o sistema normaliza antes de consultar.

Caso o cliente não seja encontrado, o consultor técnico inicia o cadastro de novo cliente.

---

## Abertura de Ordem de Serviço
Processo de registrar no sistema a solicitação de atendimento para um veículo.

Inclui:

- identificação do cliente (por número de documento)
- identificação do veículo (por placa)
- registro de problemas relatados
- registro de serviços solicitados

---

## Atribuição de Ordem de Serviço
Processo de designar um mecânico responsável para executar a ordem de serviço.

---

## Autorização de Orçamento
Ato de aprovação do orçamento pelo cliente, permitindo o início da execução dos serviços.

---

## Execução do Serviço
Processo de realização dos reparos ou serviços solicitados.

Inclui:

- execução da mão de obra
- consumo de peças
- atualização do status da ordem de serviço

---

# 11. Histórico da Ordem de Serviço

## Histórico da OS
Registro cronológico de eventos ocorridos durante o ciclo de vida de uma ordem de serviço.

Cada entrada do histórico registra:
- o código do evento (`EventoHistoricoOS`)
- a transição de estado no formato `"STATUS_ANTERIOR → STATUS_NOVO"` e eventuais detalhes na descrição
- o identificador do usuário que executou a ação
- o timestamp exato do evento

Eventos registrados (por ordem de ocorrência no fluxo normal):

| Evento | Transição |
|---|---|
| `ORDEM_ABERTA` | (inicial) |
| `MECANICO_ATRIBUIDO` | RECEBIDA → ATRIBUIDA |
| `DIAGNOSTICO_REGISTRADO` | ATRIBUIDA → EM_DIAGNOSTICO |
| `ORCAMENTO_GERADO` | ATRIBUIDA/EM_DIAGNOSTICO → AGUARDANDO_APROVACAO |
| `ORCAMENTO_APROVADO` | AGUARDANDO_APROVACAO → APROVADA |
| `ORCAMENTO_REJEITADO` | AGUARDANDO_APROVACAO → CANCELADA |
| `EXECUCAO_INICIADA` | APROVADA → EM_EXECUCAO |
| `PECA_CONSUMIDA` | (sem transição de status) |
| `ORDEM_FINALIZADA` | EM_EXECUCAO → FINALIZADA |
| `VEICULO_ENTREGUE` | FINALIZADA → ENTREGUE |

O histórico é imutável — novas entradas são adicionadas, nunca alteradas.

---

# 12. Ciclo de Vida da Ordem de Serviço

Estados possíveis de uma ordem de serviço:

    Recebida
    Atribuída
    Em Diagnóstico
    Aguardando Aprovação
    Aprovada
    Em Execução
    Finalizada
    Entregue
    Cancelada

Nem todas as ordens de serviço passam pelo estado **Em Diagnóstico**.
Ordens que envolvem apenas serviços solicitados podem avançar diretamente para **Aguardando Aprovação**.

---

# 13. Aggregates do Domínio

A modelagem do domínio organiza-se em torno dos seguintes Aggregates.

## OrdemServico (Aggregate Root Principal)

Aggregate responsável por encapsular o ciclo completo de atendimento do veículo.

Contém:

- problemas relatados
- serviços solicitados
- diagnóstico
- orçamento
- linhas de serviço
- consumo de peças
- histórico da ordem de serviço
- estado atual da ordem de serviço

Todas as regras de negócio relacionadas à execução de serviços devem ser controladas por este aggregate.

---

## Cliente (Aggregate Root)

Aggregate responsável por representar a entidade cliente que solicita serviços.

Mantém apenas informações relacionadas ao cliente.

---

## Veiculo (Aggregate Root)

Aggregate responsável por representar o veículo atendido pela oficina.

Mantém apenas informações relacionadas ao veículo.

---

## Estoque (Aggregate Root)

Aggregate responsável por controlar a disponibilidade de peças na oficina.

A Peça é uma entidade interna deste aggregate.

Contém:

- peças cadastradas
- quantidades disponíveis por peça
- movimentações de entrada e saída

O consumo de peças ocorre através do evento de domínio ConsumoPeca, disparado pela OrdemServico ao registrar materiais utilizados. O Estoque processa este evento e atualiza a quantidade disponível da peça correspondente.

---

## ServicoOficina (Aggregate Root)

Aggregate responsável por manter o catálogo de serviços padrão da oficina.

Contém:
- nome do serviço
- descrição opcional
- flag de ativo/inativo

Gerenciado exclusivamente pelo `ADMINISTRADOR`. Não possui ciclo de vida complexo — apenas criação, atualização e desativação.

A referência ao `ServicoOficina` dentro de uma OS é feita via ID (`servicoId`), com snapshot do nome no momento da abertura (`nomeServico`).

---

# 14. Lead-time

## Lead-time
Tempo total decorrido entre a abertura de uma Ordem de Serviço e a entrega do veículo ao cliente.

Calculado como: `timestamp do evento VEICULO_ENTREGUE` − `criadoEm da OS`

Utilizado como métrica principal de desempenho operacional da oficina.

O relatório de lead-time agrega as OS com status `ENTREGUE` e retorna:
- tempo médio
- tempo mínimo
- tempo máximo
- detalhamento por OS

---

# 15. Normalização de Documento

## Normalização de Documento
Processo de remover formatação de um CPF, CNPJ ou placa antes de persistir no banco de dados.

O banco armazena apenas o dado canônico (sem máscara). O front-end é responsável por aplicar a máscara de exibição.

Exemplos:
- CPF `"111.444.777-35"` → armazenado como `"11144477735"`
- CNPJ `"11.222.333/0001-81"` → armazenado como `"11222333000181"`
- Placa `"ABC-1234"` → armazenada como `"ABC1234"`
- CNPJ alfanumérico `"A1.B2C.3D4/E5F6-01"` → armazenado como `"A1B2C3D4E5F601"`

A normalização ocorre na camada de aplicação (use cases), antes de criar a entidade ou consultar o repositório.

---

# 16. Observação de Arquitetura

A Ordem de Serviço é o **aggregate central do sistema**, pois concentra o fluxo principal de negócio.

As operações críticas do domínio ocorrem através deste aggregate, incluindo:

- abertura de ordem de serviço
- registro de diagnóstico
- aprovação de orçamento
- execução de serviços
- consumo de peças
- finalização do atendimento

---

# 17. KPIs e Análise Operacional

## KPI (Indicador de Desempenho)
Métrica calculada sobre o histórico de eventos das Ordens de Serviço para medir a eficiência de um segmento específico do ciclo de atendimento.

Cada KPI é expresso em horas e agregado com média, mínimo, máximo e total de amostras.

Os KPIs pré-definidos do sistema são:

| KPI | Evento início | Evento fim | O que mede |
|---|---|---|---|
| `esperaAtribuicao` | `ORDEM_ABERTA` | `MECANICO_ATRIBUIDO` | Agilidade da recepção |
| `diagnosticoOrcamento` | `MECANICO_ATRIBUIDO` | `ORCAMENTO_GERADO` | Agilidade técnica inicial |
| `aprovacaoCliente` | `ORCAMENTO_GERADO` | `ORCAMENTO_APROVADO` | Tempo fora do controle da oficina |
| `execucao` | `EXECUCAO_INICIADA` | `ORDEM_FINALIZADA` | Produtividade do mecânico |
| `esperaEntrega` | `ORDEM_FINALIZADA` | `VEICULO_ENTREGUE` | Eficiência de entrega |
| `leadTimeTotal` | `ORDEM_ABERTA` | `VEICULO_ENTREGUE` | Ocupação de vaga de garagem |
| `tempoTecnicoLiquido` | — | — | Tempo efetivo da equipe técnica (ver abaixo) |

---

## Tempo Técnico Líquido
Tempo em que a Ordem de Serviço esteve efetivamente nas mãos da equipe técnica da oficina, excluindo os períodos em que o processo aguardava ação externa.

Calculado como:

`leadTimeTotal − esperaAtribuicao − aprovacaoCliente − esperaEntrega`

O resultado representa o tempo de responsabilidade direta da equipe técnica sobre a OS.

---

## Taxa de Aprovação de Orçamento
Percentual de orçamentos aprovados sobre o total de orçamentos gerados.

Indica a efetividade comercial e a qualidade da comunicação do orçamento ao cliente.

---

## Tempo de Ciclo Personalizado
Cálculo da duração entre quaisquer dois eventos do histórico de uma OS, com suporte a descontos de intervalos intermediários.

Permite construir análises específicas como:
- "tempo do mecânico" = `MECANICO_ATRIBUIDO → ORDEM_FINALIZADA` descontando `ORCAMENTO_GERADO:ORCAMENTO_APROVADO`
- "tempo puro de execução" = `EXECUCAO_INICIADA → ORDEM_FINALIZADA` sem descontos

O desconto é definido como um par de eventos `EVENTO_INICIO:EVENTO_FIM`. Se a OS não possuir os dois eventos do par, o desconto é ignorado para aquela OS.