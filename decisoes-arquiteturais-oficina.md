# Comentários de Arquiteto — Decisões de Modelagem e Escopo

## 1. Objetivo do documento

Este documento registra as principais decisões arquiteturais e de modelagem adotadas para o MVP do sistema de gestão de oficina mecânica.

O objetivo é apoiar a defesa técnica do projeto, explicando:

- o contexto de cada decisão
- a alternativa escolhida
- a justificativa
- os trade-offs envolvidos
- as alternativas conscientemente não adotadas no MVP

---

## 2. Decisão: Cliente e Veículo não possuem vínculo estrutural direto

### Contexto
Em uma oficina mecânica, não é seguro assumir que o cliente atendido é o proprietário permanente do veículo.

Exemplos reais:
- o veículo pode ser vendido sem que a oficina seja informada
- um pai pode levar o carro do filho
- um amigo pode levar o carro de outra pessoa
- uma empresa pode levar um veículo utilizado por terceiros

### Decisão
Não modelar a relação `Cliente -> possui -> Veiculo`.

A relação entre Cliente e Veículo ocorre exclusivamente por meio da Ordem de Serviço.

### Justificativa
Essa modelagem é mais fiel ao domínio real e evita inconsistências históricas.

Com essa abordagem:
- um mesmo veículo pode aparecer em OS associadas a clientes diferentes ao longo do tempo
- o histórico do veículo é preservado corretamente
- o sistema não força uma noção de propriedade que o domínio não garante

### Trade-offs
- caso futuramente seja necessário rastrear propriedade formal do veículo, será necessário introduzir outro conceito de domínio
- a consulta de relacionamento entre cliente e veículo passa a depender da OS

### Alternativa não adotada
Modelar `clienteId` diretamente no cadastro do veículo.

Essa alternativa foi rejeitada por criar um vínculo permanente artificial e incorreto para o domínio.

---

## 3. Decisão: Ordem de Serviço como Aggregate Root principal

### Contexto
O processo principal do negócio gira em torno do atendimento do veículo, do diagnóstico, do orçamento, da execução e da entrega.

### Decisão
Definir `OrdemServico` como o aggregate central do sistema.

### Justificativa
A OS é o elemento que conecta:
- cliente
- veículo
- mecânico responsável
- problemas relatados
- serviços solicitados
- diagnóstico
- orçamento
- linhas de serviço
- histórico
- status

Centralizar o fluxo na OS simplifica o modelo e mantém as regras críticas dentro da fronteira correta de consistência.

### Trade-offs
- a OS concentra parte relevante das regras de negócio do sistema
- exige cuidado para não transformar a entidade em um objeto excessivamente inchado

### Alternativa não adotada
Distribuir o fluxo principal em múltiplos aggregates independentes para diagnóstico, orçamento e execução.

Essa alternativa foi rejeitada no MVP por aumentar desnecessariamente a complexidade transacional e de orquestração.

---

## 4. Decisão: Não utilizar o estado RASCUNHO no MVP

### Contexto
Na fase de abertura da OS surgiu a possibilidade de criar o estado `RASCUNHO`.

### Decisão
Não modelar o estado `RASCUNHO` no MVP.

### Justificativa
Optamos por não modelar o estado Rascunho pois não existe fluxo de persistência parcial no domínio atual. Isso evita complexidade desnecessária e mantém o modelo alinhado ao negócio.

A OS só passa a existir no sistema quando já é válida, contendo:
- cliente
- veículo
- ao menos um problema relatado ou serviço solicitado

### Trade-offs
- caso no futuro exista fluxo de salvamento parcial, será necessário evoluir a máquina de estados
- o backend assume que a criação da OS é uma operação atômica e completa

### Alternativa não adotada
Criar `RASCUNHO` desde o início “por precaução”.

Essa alternativa foi rejeitada por representar complexidade antecipada sem suporte em um fluxo real do domínio atual.

---

## 5. Decisão: Problema Relatado é opcional

### Contexto
Nem toda OS nasce de uma falha relatada. Em muitos casos, o cliente apenas solicita um serviço direto.

Exemplos:
- troca de óleo
- troca de fluido
- revisão preventiva

### Decisão
Modelar `ProblemaRelatado` como opcional.

A OS pode conter:
- apenas problema relatado
- apenas serviço solicitado
- ambos

### Justificativa
Essa decisão representa corretamente os cenários reais da oficina.

### Regra central
A OS não pode ser criada vazia.

Deve existir pelo menos:
- um problema relatado
**ou**
- um serviço solicitado

### Trade-offs
- a lógica de status precisa suportar OS com e sem diagnóstico
- o fluxo da OS precisa contemplar caminhos alternativos

### Alternativa não adotada
Obrigar todo atendimento a possuir problema relatado.

Essa alternativa foi rejeitada por não representar serviços recorrentes e preventivos.

---

## 6. Decisão: Diagnóstico é opcional

### Contexto
Se a OS tiver apenas um serviço solicitado, o estado `EM_DIAGNOSTICO` pode não fazer sentido.

### Decisão
Modelar o diagnóstico como etapa opcional do fluxo.

### Justificativa
Algumas OS exigem investigação técnica; outras seguem diretamente para orçamento com base no pedido do cliente.

### Consequência positiva
O fluxo da OS passa a refletir melhor o mundo real:
- com diagnóstico, quando necessário
- sem diagnóstico, quando desnecessário

### Alternativa não adotada
Obrigar toda OS a passar por diagnóstico.

Essa alternativa foi rejeitada por introduzir uma etapa artificial e improdutiva em atendimentos simples.

---

## 7. Decisão: Linha de Serviço com tipo MATERIAL ou SERVICO

### Contexto
Nem toda linha do orçamento representa uma peça. Há linhas que representam mão de obra.

Exemplo de orçamento:
- óleo 5W30
- filtro de óleo
- mão de obra de troca de óleo

### Decisão
Modelar `LinhaServico` com um atributo de tipo:
- `MATERIAL`
- `SERVICO`

### Justificativa
Essa abordagem representa corretamente:
- itens físicos que podem consumir estoque
- atividades técnicas que não possuem peça associada

Além disso, é simples de implementar em NestJS + Prisma e suficientemente expressiva para o MVP.

### Trade-offs
- exige validações por tipo
- mantém em uma mesma estrutura conceitos semanticamente distintos, ainda que relacionados

### Alternativa não adotada
Criar herança ou entidades separadas para `LinhaMaterial` e `LinhaServico`.

Essa alternativa foi rejeitada no MVP por elevar a complexidade de modelagem e persistência sem ganho proporcional.

---

## 8. Decisão: Orçamento como entidade interna da OS

### Contexto
O orçamento aparece no processo como uma composição transitória de linhas de serviço, diretamente vinculada à OS.

### Decisão
Modelar `Orcamento` como entidade interna do aggregate `OrdemServico`, e não como aggregate separado.

### Justificativa
No escopo do MVP, o orçamento não possui ciclo de vida autônomo fora da OS.

Tratá-lo como parte da OS:
- simplifica transações
- simplifica persistência
- reduz acoplamento entre aggregates
- facilita a implementação do fluxo ponta-a-ponta

### Trade-offs
- se no futuro o orçamento adquirir autonomia funcional, a modelagem precisará evoluir

### Alternativa não adotada
Criar `Orcamento` como aggregate independente.

Essa alternativa foi rejeitada porque o domínio atual não justifica a complexidade adicional.

---

## 9. Decisão: FINALIZADA e ENTREGUE são estados distintos

### Contexto
Existe diferença entre:
- serviço concluído tecnicamente
- veículo efetivamente retirado pelo cliente

### Decisão
Separar os estados:
- `FINALIZADA`
- `ENTREGUE`

### Justificativa
Essa distinção é importante em sistemas reais, pois permite representar corretamente o período em que o veículo está pronto, mas ainda não foi retirado.

### Benefícios
- melhora rastreabilidade operacional
- evita ambiguidade
- permite futuras notificações e controles de permanência

### Alternativa não adotada
Usar um único estado para serviço pronto e veículo entregue.

Essa alternativa foi rejeitada por perder precisão semântica do processo.

---

## 10. Decisão: Não utilizar ENCERRADA no MVP

### Contexto
Na fase de entrega surgiu a possibilidade de usar um estado adicional `ENCERRADA`.

### Decisão
Não utilizar `ENCERRADA` no MVP.

### Justificativa
No escopo atual, o estado `ENTREGUE` já representa adequadamente o fim do fluxo operacional.

`ENCERRADA` faria mais sentido em um cenário com:
- faturamento
- nota fiscal
- fechamento financeiro
- auditoria administrativa

Como esses processos não fazem parte do MVP, o estado adicional foi considerado desnecessário.

### Trade-offs
- se no futuro houver fluxo administrativo separado, a máquina de estados precisará evoluir

### Alternativa não adotada
Manter `ENCERRADA` desde já.

Essa alternativa foi rejeitada por antecipar complexidade sem suporte funcional no escopo atual.

---

## 11. Decisão: Cancelamento após rejeição do orçamento

### Contexto
Quando o cliente rejeita o orçamento, o atendimento não prossegue.

### Decisão
Modelar a rejeição do orçamento levando a OS para `CANCELADA`.

### Justificativa
A rejeição encerra o fluxo operacional daquela solicitação.

### Observação
Mesmo cancelada, a OS pode continuar armazenada para histórico, rastreabilidade e consulta.

### Alternativa não adotada
Permitir que a OS rejeitada retorne ao fluxo normal sem nova ação explícita.

Essa alternativa foi rejeitada para manter o comportamento do processo mais claro e previsível.

---

## 12. Decisão: Estoque como Aggregate Root separado com Peça como entidade interna

### Contexto
O sistema precisa controlar a disponibilidade de peças utilizadas nas ordens de serviço.

### Decisão
Modelar `Estoque` como Aggregate Root independente. `Peca` é uma entidade interna do aggregate `Estoque`, não um aggregate root independente.

### Justificativa
O estoque possui regras e ciclo de vida próprios (entrada, saída, controle de quantidade). Separar `Estoque` como aggregate garante que as regras de consistência de inventário fiquem dentro de uma fronteira bem definida.

Tratar `Peca` como entidade interna simplifica a modelagem sem perder expressividade, pois a peça somente faz sentido existir no contexto de um estoque gerenciado.

### Mecanismo de integração com a OrdemServico
O consumo de peças é representado pelo evento de domínio `ConsumoPeca`, disparado pela `OrdemServico` ao registrar materiais utilizados. O aggregate `Estoque` processa este evento e atualiza a quantidade disponível.

### Trade-offs
- a comunicação entre aggregates ocorre via eventos de domínio, não por chamada direta
- exige atenção à consistência eventual entre OS e Estoque

### Alternativa não adotada
Tratar `Peca` como aggregate root independente do estoque.

Essa alternativa foi rejeitada por diluir a responsabilidade de controle de inventário e criar acoplamento desnecessário.

---

## 13. Decisão: MecanicoResponsavel como associação, não como entidade

### Contexto
Uma OS precisa registrar qual mecânico é o responsável técnico pelo atendimento, com a regra de que apenas usuários com papel `MECANICO` podem ser designados.

### Decisão
`MecanicoResponsavel` não é uma entidade independente nem uma subclasse de `UsuarioInterno`. É representado na `OrdemServico` como um campo `mecanicoResponsavelId` do tipo `UsuarioId`.

### Justificativa
Criar uma entidade separada apenas para representar a designação de um mecânico seria sobre-engenharia. A regra de negócio ("só MECANICO pode ser atribuído") é uma responsabilidade do aggregate `OrdemServico`, enforçada no método de atribuição.

### Implementação esperada
```typescript
atribuirMecanico(mecanico: UsuarioInterno): void {
  if (mecanico.papel !== PapelUsuario.MECANICO) {
    throw new Error('Somente um mecânico pode ser atribuído à ordem de serviço');
  }
  this.mecanicoResponsavelId = mecanico.id;
}
```

### Trade-offs
- a validação do papel depende de o chamador fornecer o objeto `UsuarioInterno` completo, não apenas o ID
- nenhuma tabela adicional é necessária no banco

### Alternativa não adotada
Criar subclasse `MecanicoResponsavel extends UsuarioInterno` ou entidade separada.

Essa alternativa foi rejeitada por introduzir complexidade de herança sem ganho real de expressividade no domínio.

---

## 14. Decisão: ULID com prefixo por entidade para identificadores públicos

### Contexto
O sistema precisa de identificadores únicos para referenciar objetos nas URLs da API sem expor dados sensíveis como número sequencial de OS, CPF, ou quantidade de clientes.

### Decisão
Utilizar ULID (Universally Unique Lexicographically Sortable Identifier) como gerador de IDs, combinado com um prefixo textual por entidade.

Exemplos:
- `os01JXYZ...` — OrdemServico
- `cl01JXYZ...` — Cliente
- `ve01JXYZ...` — Veiculo
- `us01JXYZ...` — Usuario
- `pc01JXYZ...` — Peca

### Justificativa
ULID oferece:
- 128 bits de unicidade (mesma segurança que UUID v4)
- ordenação lexicográfica por tempo de criação (útil para paginação e debug)
- ausência de caracteres especiais (URL-safe)
- prefixo por entidade facilita debugging e evita confusão entre IDs

### Trade-offs
- IDs são opacos por design — não carregam semântica de negócio
- cada entidade ainda mantém seus identificadores de negócio próprios (CPF para clientes, placa para veículos, número da OS para operação)

### Alternativa não adotada
Implementar gerador próprio de IDs baseado em SHA256 e bytes aleatórios.

Essa alternativa foi rejeitada por reinventar algo que bibliotecas consolidadas já resolvem de forma mais robusta e testada. A biblioteca `ulidx` ou `ulid` será utilizada.

---

## 15. Decisão: Simplicidade deliberada no MVP

### Contexto
O projeto é um MVP acadêmico com foco em boas práticas de arquitetura, e não um ERP completo de oficina.

### Decisão
Adotar uma modelagem intencionalmente simples, mas semanticamente correta.

### Princípios aplicados
- DDD leve
- Clean Architecture
- SOLID
- KISS
- Separation of Concerns

### O que foi conscientemente evitado
- estados desnecessários
- aggregates excessivos
- heranças complexas
- workflows administrativos fora do escopo
- overengineering

### Defesa técnica
A simplificação não foi casual; foi uma decisão arquitetural deliberada para preservar clareza, foco no domínio e viabilidade de implementação.

---

## 16. Decisão: Cliente como pessoa física ou jurídica com documento genérico

### Contexto
Uma oficina mecânica atende tanto clientes individuais (pessoa física) quanto empresas (pessoa jurídica). Cada tipo possui um documento fiscal diferente: CPF para PF e CNPJ para PJ.

### Decisão
Modelar o aggregate `Cliente` com dois campos: `tipoDoc` (enum `CPF | CNPJ`) e `numeroDoc` (string — o número do documento). O `numeroDoc` é o identificador único de negócio, independente do tipo.

### Justificativa
- Representa corretamente o domínio real sem criar hierarquias de herança desnecessárias
- Um único campo `@unique` (`numeroDoc`) substitui dois campos únicos separados (`cpf` e `cnpj`)
- A validação do formato é condicional ao `tipoDoc`, aplicada na camada de interface via `@ValidateIf`
- Utilitário interno `src/shared/utils/documento-validator.ts` centraliza validação, formatação e limpeza dos documentos — suporta o novo CNPJ alfanumérico (vigente julho/2026)

### Trade-offs
- `tipoDoc` e `numeroDoc` são imutáveis após o cadastro — alterar o tipo de pessoa exigiria recadastro
- A rota de busca `GET /clientes/documento/:numeroDoc` aceita tanto CPF quanto CNPJ sem distinção na URL

### Alternativa não adotada
Criar campos separados `cpf` e `cnpj` com `@unique` em cada um, ou criar entidades `ClientePF` e `ClientePJ`.

Essas alternativas foram rejeitadas por criar redundância no schema (dois campos únicos potencialmente nulos) ou por introduzir herança sem ganho real de expressividade no domínio do MVP.

---

---

## 17. Decisão: Validador de CPF/CNPJ embutido em vez de biblioteca npm

### Contexto
O sistema precisa validar CPF (pessoa física) e CNPJ (pessoa jurídica). A Receita Federal publicou nova norma estabelecendo que a partir de julho de 2026 novos CNPJs serão emitidos no formato alfanumérico (primeiros 12 caracteres podendo conter letras).

### Decisão
Não utilizar a biblioteca `cpf-cnpj-validator` (npm). Embutir o código do projeto open-source `cnpj-cpf-validator` de Frederico Ferreira (MIT) diretamente no repositório em `src/shared/utils/documento-validator.ts`.

### Justificativa
- A biblioteca `cpf-cnpj-validator` (npm) não suporta o novo formato alfanumérico de CNPJ
- O projeto `cnpj-cpf-validator` suporta ambos os formatos, mas não foi publicado no npm
- A licença MIT permite uso e redistribuição com manutenção do aviso de copyright — o que foi feito no cabeçalho do arquivo
- Zero dependências externas adicionais
- Expõe `cleanCPF` e `cleanCNPJ` utilizados na normalização de dados

### Trade-offs
- Responsabilidade de manter o código atualizado conforme evoluções da Receita Federal
- O arquivo deve referenciar sempre a origem e a licença original

### Alternativa não adotada
Continuar usando `cpf-cnpj-validator` do npm.

Rejeitada por não suportar o novo formato alfanumérico do CNPJ, tornando o sistema obsoleto antes mesmo de entrar em produção estável.

---

## 18. Decisão: Normalização de dados na camada de aplicação

### Contexto
Campos como `placa` e `numeroDoc` podem ser recebidos pelo front-end em diferentes formatos:
- CPF: `"111.444.777-35"` ou `"11144477735"`
- CNPJ: `"11.222.333/0001-81"` ou `"11222333000181"`
- Placa: `"ABC-1234"` ou `"ABC1234"` ou `"abc1234"`

### Decisão
Normalizar esses campos na camada de **application** (use cases), antes de persistir ou consultar, e armazenar sempre o dado limpo no banco.

- `numeroDoc`: `cleanCPF()` para CPF (só dígitos), `cleanCNPJ()` para CNPJ (dígitos ou alfanumérico)
- `placa`: `toUpperCase().replace(/[^A-Z0-9]/g, '')`

### Justificativa
- O banco sempre armazena dados no formato canônico — buscas por `placa` ou `numeroDoc` são determinísticas
- O front-end aplica máscaras de exibição sem depender do formato de storage
- A normalização no use case mantém a camada de domínio limpa e a de interface flexível

### Trade-offs
- Dados antigos inconsistentes (se existirem) precisariam de migração
- A camada de interface aceita qualquer formato, a camada de aplicação assume a responsabilidade de normalizar

---

## 19. Decisão: Histórico de transições de estado com campos estruturados statusAnterior/statusNovo

### Contexto
O histórico da OS precisa rastrear não apenas o evento ocorrido, mas também qual foi a mudança de estado, quem a executou e quando. A versão inicial registrava a transição apenas no campo `descricao` como texto livre (`"RECEBIDA → ATRIBUIDA | detalhe"`), o que impedia processamento programático confiável.

### Decisão
Toda transição de estado registra uma entrada em `HistoricoOS` com:
- `evento`: código do enum `EventoHistoricoOS`
- `descricao`: formato `"STATUS_ANTERIOR → STATUS_NOVO | detalhe opcional"` (human-readable, mantido para rastreabilidade)
- `usuarioId`: ID do usuário que executou a ação
- `statusAnterior`: enum `StatusOrdemServico?` — status antes da transição (null apenas em `ORDEM_ABERTA`)
- `statusNovo`: enum `StatusOrdemServico?` — status resultante da transição
- `criadoEm`: timestamp do momento da transição

Eventos sem mudança de status (`PECA_CONSUMIDA`, `DIAGNOSTICO_REGISTRADO` após `iniciarDiagnostico`) registram `statusAnterior === statusNovo` (nenhum campo fica null exceto `ORDEM_ABERTA` no `statusAnterior`).

O primeiro evento do ciclo de vida (`ORDEM_ABERTA`) é registrado no factory method `OrdemServico.abrir()` com `statusAnterior = null` e `statusNovo = RECEBIDA`.

### Justificativa
- Campos tipados permitem filtros, análises e relatórios sem parsing de string
- Complementa o campo `evento` (que indica *o que aconteceu*) com informação estruturada sobre *como o status mudou*
- Compatibilidade retroativa: ambos os campos são nullable na migration, evitando quebra de registros históricos pré-existentes
- O campo `descricao` é mantido por ser human-readable e útil para auditoria manual

### Trade-offs
- Leve redundância entre `descricao` (textual) e `statusAnterior`/`statusNovo` (tipados) — aceitável dado o valor analítico dos campos estruturados

---

## 20. Decisão: Relatório de lead-time via histórico da OS

### Contexto
O sistema precisa permitir que administradores e consultores visualizem o tempo médio de atendimento das ordens de serviço — do momento de abertura até a entrega do veículo.

### Decisão
Implementar o endpoint `GET /api/v1/ordens-servico/relatorio/lead-time` que:
- Busca todas as OS com status `ENTREGUE`
- Calcula o lead-time de cada uma: `criadoEm` da OS → `criadoEm` do evento `VEICULO_ENTREGUE` no histórico
- Retorna estatísticas: total, média, mínimo, máximo e listagem detalhada

### Justificativa
O lead-time é a principal métrica operacional de uma oficina. Medir o tempo ponta-a-ponta permite identificar gargalos no processo. Usar o histórico como fonte do timestamp de entrega garante precisão mesmo se `atualizadoEm` for modificado por outros eventos.

### Trade-offs
- A query carrega todas as OS entregues em memória — para grandes volumes seria necessário calcular no banco via SQL agregado
- O fallback para `atualizadoEm` em caso de evento não encontrado garante robustez para dados legados

---

## 21. Decisão: Sistema de KPIs baseado em eventos do histórico da OS

### Contexto
O sistema precisa expor métricas operacionais para administradores e consultores avaliarem a eficiência do processo de atendimento. As métricas precisam ser flexíveis o suficiente para análises ad hoc, além dos KPIs pré-definidos.

### Decisão
Implementar dois endpoints de análise baseados nos timestamps dos eventos já armazenados em `historico_os`:

1. `GET /relatorio/kpis` — KPIs pré-definidos (sete segmentos + taxa de aprovação), calculados sobre todas as OS ou um subconjunto via `osIds`
2. `GET /relatorio/tempo-ciclo` — cálculo flexível entre quaisquer dois eventos com descontos opcionais de intervalos intermediários

### Justificativa
O histórico já existe como estrutura de rastreabilidade. Reutilizá-lo como fonte de dados analíticos evita introduzir uma camada de eventos separada (event store) no MVP. Os timestamps de cada `EventoHistoricoOS` são suficientemente precisos para os KPIs requeridos.

O modelo de "descontos" permite que o mesmo endpoint cubra análises distintas:
- lead-time bruto (sem descontos)
- tempo técnico líquido (descontando espera de atribuição, aprovação do cliente e espera de entrega)
- tempo do mecânico (descontando apenas aprovação do cliente)

### Trade-offs
- A query carrega os registros selecionados em memória para cálculo — para volumes muito grandes seria mais eficiente SQL agregado; para o MVP é suficiente
- O modelo depende de eventos do histórico estarem presentes; OS abertas antes da implementação do histórico não contribuem para alguns KPIs
- KPIs pré-definidos fixam os nomes dos eventos — mudança de convenção de eventos exige atualização dos use cases

### Alternativa não adotada
Criar tabelas de fatos e dimensões (data warehouse) para os relatórios.

Rejeitada por ser sobre-engenharia para o escopo do MVP acadêmico.

---

## 22. Decisão: Filtro por osIds com WHERE IN no banco, não em memória

### Contexto
Os endpoints de KPI e tempo de ciclo precisam suportar análise de um subconjunto específico de OS (por exemplo, todas as OS de um mecânico, ou uma OS individual para auditoria).

### Decisão
O parâmetro `osIds` é repassado diretamente ao repositório, que aplica `WHERE id IN (...)` na query Prisma. O filtro nunca ocorre em memória após `SELECT *`.

```typescript
// Repositório
async buscarTodasComHistorico(osIds?: string[]): Promise<OrdemServico[]> {
  return this.prisma.ordemServico.findMany({
    where: osIds?.length ? { id: { in: osIds } } : undefined,
    include: INCLUDE_COMPLETO,
  });
}
```

### Justificativa
Carregar todas as OS em memória para depois filtrar por ID é ineficiente e não escala. Delegar o filtro ao banco garante que apenas os registros necessários trafegam do banco para a aplicação, independentemente do volume de OS no sistema.

### Trade-offs
- Sem impacto negativo: o caso sem filtro continua funcionando (`WHERE` omitido quando `osIds` é vazio)
- A interface do repositório expõe o conceito de filtragem opcional, que deve ser documentada para implementações alternativas futuras

### Alternativa não adotada
Filtrar em memória após `buscarTodasComHistorico()`.

Rejeitada por ineficiência: em sistemas com muitas OS, carregaria dados desnecessários apenas para descartá-los imediatamente.

---

## 24. Decisão: ServicoOficina como catálogo de referência para serviços solicitados

### Contexto
Ao abrir uma OS, o consultor técnico pode informar serviços solicitados pelo cliente. Originalmente esses serviços eram descritos em texto livre, o que dificultava agrupamento, padronização e relatórios por tipo de serviço.

### Decisão
Criar um aggregate `ServicoOficina` como catálogo gerenciado pelo administrador. Um `ServicoSolicitado` dentro da OS passa a referenciar um `ServicoOficina` pelo seu ID, em vez de conter texto livre.

- Prefixo de ID: `sv` (ex: `sv01JXYZ...`)
- Atributos: `nome`, `descricao?`, `ativo`
- Sem preço base — o preço é sempre definido pelo mecânico no momento do orçamento
- O catálogo pode ser desativado (`ativo = false`) sem excluir dados históricos

### Justificativa
- Permite padronizar os serviços mais comuns da oficina
- Facilita agrupamentos e análises por tipo de serviço
- Mantém texto livre para `ProblemaRelatado`, pois problemas são naturalmente não estruturados
- Não impõe preço no catálogo — cada orçamento é composto manualmente pelo mecânico

### Trade-offs
- Consultor técnico precisa que o catálogo esteja pré-configurado antes de abrir uma OS com serviços solicitados
- Mudanças no nome do serviço no catálogo não afetam OS históricas (ver decisão §26)

### Alternativa não adotada
Manter texto livre para serviços solicitados.

Rejeitada por impedir padronização e dificultar análises operacionais futuras.

---

## 25. Decisão: Orçamento estruturado em GrupoOrcamento

### Contexto
Orçamentos de oficina frequentemente envolvem múltiplos serviços distintos. Um único bloco de linhas dificulta a leitura pelo cliente e a organização pelo mecânico.

### Decisão
Reestruturar o orçamento introduzindo o value object `GrupoOrcamento` como nível intermediário entre `Orcamento` e `LinhaServico`.

Estrutura resultante:
```
Orcamento
  └─ GrupoOrcamento[] (título livre, ex: "Retífica do Motor")
       └─ LinhaServico[] (MATERIAL ou SERVICO)
```

O mecânico organiza o orçamento em grupos temáticos com título livre. Cada grupo contém ao menos uma linha de serviço. O total do orçamento é a soma dos totais dos grupos.

### Justificativa
- Melhora a legibilidade do orçamento para o cliente
- Permite ao mecânico organizar serviços correlatos sob um mesmo tema
- Facilita comparação e aprovação parcial (futura) por grupo
- Reflete o modo como orçamentos reais de oficina são apresentados

### Trade-offs
- Adiciona um nível de aninhamento ao schema (grupo entre orçamento e linha)
- Queries de persistência precisam fazer include em dois níveis (`grupos.linhasServico`)

### Alternativa não adotada
Manter lista plana de linhas diretamente no orçamento.

Rejeitada por não representar adequadamente a estrutura real de um orçamento de oficina com múltiplos serviços distintos.

---

## 26. Decisão: Snapshot de nomeServico no ServicoSolicitado

### Contexto
Ao abrir uma OS, o consultor seleciona serviços do catálogo `ServicoOficina`. O nome do serviço no catálogo pode ser alterado pelo administrador após a abertura da OS.

### Decisão
No momento da abertura da OS, o sistema captura e persiste o `nomeServico` (nome do `ServicoOficina` naquele instante) diretamente no `ServicoSolicitado`.

```typescript
// Ao abrir a OS:
const servico = await servicoRepository.buscarPorId(ServicoOficinaId.de(s.servicoId));
return { servicoId: s.servicoId, nomeServico: servico.nome, observacao: s.observacao };
```

### Justificativa
- Preserva a integridade histórica — a OS registra exatamente o que foi solicitado no momento da abertura
- Renomear um serviço no catálogo não corrompe OS históricas
- O `servicoId` mantém a rastreabilidade para eventual correlação futura com o catálogo

### Trade-offs
- O `nomeServico` na OS pode divergir do nome atual no catálogo — isso é intencional
- A consulta de OS históricas pode exibir um nome que não existe mais no catálogo com esse texto

### Alternativa não adotada
Exibir sempre o nome atual do catálogo via JOIN.

Rejeitada por comprometer a integridade histórica — o cliente pode ter aprovado o orçamento com base em um nome diferente do atual.

---

## 27. Decisão: Campos notasInternas e notasCliente em OrdemServico e Orcamento

### Contexto
A oficina precisa registrar informações de dois tipos distintos: notas operacionais internas (não visíveis ao cliente) e notas voltadas ao cliente (visíveis no orçamento e comunicações).

### Decisão
Adicionar dois campos opcionais a `OrdemServico` e a `Orcamento`:
- `notasInternas`: notas da equipe interna da oficina — não visíveis ao cliente
- `notasCliente`: notas enviadas ao cliente junto com o orçamento ou durante o atendimento

Os campos existem em ambos os agregados pois as notas têm contextos distintos:
- Notas da OS: contexto geral do atendimento (recepção, condições do veículo)
- Notas do orçamento: detalhes do orçamento enviado ao cliente

### Justificativa
- Separa claramente informações internas de comunicação externa
- Evita que notas operacionais vazem para o cliente inadvertidamente
- Reflete o funcionamento real de sistemas de oficina

### Trade-offs
- Dois campos em vez de um — pequena duplicação de estrutura
- A distinção de visibilidade é responsabilidade do front-end e não é enforçada na API no MVP

---

## 23. Síntese para defesa do projeto

As decisões adotadas priorizam:

- aderência ao domínio real da oficina
- clareza do modelo
- simplicidade do MVP
- facilidade de implementação no backend
- baixo acoplamento
- evolução futura sem comprometer o desenho inicial

Em resumo, o projeto busca equilíbrio entre:
- fidelidade ao negócio
- boa modelagem orientada a domínio
- pragmatismo de implementação
