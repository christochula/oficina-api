# Decisoes Arquiteturais - oficina_api

## 1. Objetivo

Este documento registra as decisoes que aparecem no codigo atual do repositorio, com motivacoes e trade-offs.

---

## 2. Monolito modular em camadas

### Decisao

Organizar o sistema como monolito modular com NestJS, separando:

- `domain`
- `application`
- `infrastructure`
- `interfaces`
- `shared`

### Justificativa

O produto ainda tem porte de MVP, mas o dominio ja pede fronteiras claras entre contextos.

### Trade-offs

- operacao mais simples que microservicos
- facil de manter transacoes cross-aggregate
- exige disciplina para evitar acoplamento entre modulos

---

## 3. OrdemServico como aggregate central

### Decisao

`OrdemServico` concentra o fluxo operacional:

- abertura
- atribuicao
- diagnostico
- geracao de orcamento
- aprovacao ou rejeicao
- execucao
- consumo de pecas
- finalizacao
- entrega

### Justificativa

Esse aggregate representa o atendimento ponta a ponta visto pelo negocio.

### Trade-offs

- entidade rica em comportamento
- persistencia mais custosa, porque sincroniza varias estruturas filhas

---

## 4. Cliente e Veiculo sem vinculo estrutural direto

### Decisao

Nao existe relacao direta `Cliente -> Veiculo` no schema nem no dominio.

### Justificativa

No contexto da oficina, o veiculo atendido nem sempre pertence formalmente ao cliente que abriu a OS.

### Trade-offs

- modelo mais fiel ao processo real
- consultas cliente-veiculo dependem da `OrdemServico`

---

## 5. Diagnostico opcional com transicao implicita no use case

### Decisao

`RegistrarDiagnosticoUseCase` aceita OS em `ATRIBUIDA`, chama `iniciarDiagnostico()` e depois grava o diagnostico.

### Justificativa

Corrige o fluxo HTTP sem exigir uma rota exclusiva apenas para entrar em diagnostico.

### Trade-offs

- o passo "entrar em diagnostico" nao aparece como endpoint proprio
- a transicao fica encapsulada no caso de uso

---

## 6. Orcamento como parte interna da OrdemServico

### Decisao

`Orcamento`, `GrupoOrcamento` e `LinhaServico` continuam internos ao aggregate `OrdemServico`.

### Justificativa

No produto atual, o orcamento nao tem ciclo de vida autonomo fora da OS.

### Trade-offs

- simplifica API e dominio
- exige persistencia mais profunda da OS

---

## 7. Catalogo de servicos com snapshot em ServicoSolicitado

### Decisao

Na abertura da OS, `ServicoSolicitado` referencia `ServicoOficina` por `servicoId` e persiste `nomeServico`.

### Justificativa

O snapshot protege o historico caso o catalogo mude depois.

### Trade-offs

- o nome na OS pode divergir do catalogo atual, e isso e intencional
- a API ainda nao expoe endpoint de desativacao/delete, embora a entidade tenha `ativo`

---

## 8. Historico estruturado da OS

### Decisao

Toda transicao relevante registra:

- `evento`
- `descricao`
- `usuarioId`
- `statusAnterior`
- `statusNovo`
- `criadoEm`

### Justificativa

O historico serve ao mesmo tempo para auditoria operacional e relatorios.

### Trade-offs

- ha redundancia entre descricao textual e campos estruturados
- o ganho analitico compensa essa duplicacao

---

## 9. Estoque como aggregate separado

### Decisao

`Estoque` e um aggregate root proprio; `Peca` e entidade interna.

### Justificativa

Saldo, entrada e saida pertencem ao contexto de estoque, nao ao de OS.

### Trade-offs

- existe comunicacao entre aggregates
- esse ponto pede coordenacao transacional explicita

---

## 10. Consumo de peca com consistencia atomica

### Decisao

O repositorio usa uma fronteira transacional compartilhada em `RegistrarConsumoPecaUseCase`.

Implementacao atual:

- contrato `DatabaseTransactionManager`
- `PrismaTransactionManager`
- propagacao do `TransactionClient` com `AsyncLocalStorage`
- repositorios de OS e estoque aderindo ao mesmo contexto

### Justificativa

Remove a possibilidade de baixar estoque e falhar ao salvar a OS.

### Trade-offs

- infraestrutura mais sofisticada
- repositorios dependem de um gerenciador transacional compartilhado

---

## 11. JWT com revalidacao do usuario no repositorio

### Decisao

`JwtStrategy` nao confia apenas no payload; ela recarrega o usuario e rejeita:

- usuario inexistente
- usuario inativo

`AuthService` tambem bloqueia login e refresh para usuarios inativos.

### Justificativa

Permite revogacao pratica via inativacao.

### Trade-offs

- cada request autenticada faz consulta ao repositorio
- aumenta seguranca e consistencia

---

## 12. Ownership de cliente modelado com vinculo explicito

### Decisao

O sistema passou a modelar ownership do cliente por `Cliente.usuarioId`, ligando o aggregate `Cliente` a um `Usuario` com papel `CLIENTE`.

Use cases afetados:

- `BuscarMinhaOrdemServicoUseCase`
- `ListarMinhasOrdensServicoUseCase`
- `AprovarOrcamentoUseCase`
- `RejeitarOrcamentoUseCase`

### Justificativa

`Usuario.id` e `Cliente.id` pertencem a keyspaces diferentes (`us_*` e `cl_*`). A comparacao direta entre `usuario.sub` e `ordemServico.clienteId` era estruturalmente incorreta.

### Trade-offs

- o modelo ficou mais explicito e seguro
- clientes agora dependem de uma etapa de vinculacao com usuario autenticavel

---

## 13. Vinculacao de cliente por `usuarioId` explicito ou auto-link por email

### Decisao

O cadastro/atualizacao de cliente aceita `usuarioId` opcional e tambem tenta auto-vincular por email quando encontra um `Usuario CLIENTE` compativel e ainda nao associado.

### Justificativa

Isso reduz atrito operacional e permite aproveitar usuarios ja criados.

### Trade-offs

- a heuristica por email exige cuidado com dados duplicados
- por isso a migration e o auto-link so atuam de forma conservadora

---

## 14. Aprovacao e rejeicao de orcamento: CLIENTE titular com fallback ADMINISTRADOR

### Decisao

As rotas:

- `PATCH /ordens-servico/:id/aprovar`
- `PATCH /ordens-servico/:id/rejeitar`

permitem `CLIENTE` e `ADMINISTRADOR`. O `CLIENTE` valida ownership do recurso. O `ADMINISTRADOR` atua como fallback operacional para situacoes em que o cliente nao consegue aprovar pela aplicacao.

### Justificativa

O orcamento e uma decisao do cliente, mas o admin precisa conseguir desbloquear o fluxo quando houver impedimento pratico.

### Trade-offs

- `CONSULTOR_TECNICO` nao pode aprovar/rejeitar
- o fluxo e coerente com a regra de negocio e com a demonstracao de ownership

---

## 15. Analiticos baseados em historico e calculados na aplicacao

### Decisao

Lead-time, KPIs e tempo de ciclo personalizado sao calculados em use cases sobre OS carregadas com historico completo.

### Justificativa

Para o volume atual do MVP, isso reduz complexidade e reaproveita o historico ja persistido.

### Trade-offs

- nao escala tao bem quanto SQL agregado ou pipeline analitico dedicado
- o calculo depende de carregar registros em memoria

---

## 16. Testes automatizados fortes em unit/spec e minimos em e2e real

### Decisao

O repositorio privilegia testes em `src/**/*.spec.ts` e mantem apenas um smoke e2e em `test/app.e2e-spec.ts`.

### Justificativa

Feedback rapido e baixo custo de infraestrutura durante a evolucao do MVP.

### Trade-offs

- ainda nao ha validacao automatizada do fluxo completo contra PostgreSQL real
- regressao ponta a ponta continua dependendo de roteiro manual

---

## 17. Indices de performance em colunas frequentemente filtradas

### Decisao

O schema declara indices explícitos em:

- `ordens_servico`: `clienteId`, `status`, `mecanicoResponsavelId`
- `historico_os`: composto `(ordemServicoId, criadoEm)`
- `consumos_peca`, `problemas_relatados`, `servicos_solicitados`: `ordemServicoId`

### Justificativa

Sem estes indices, queries de listagem com filtro e includes com orderBy sofrem full table scan conforme o volume de dados cresce.

### Trade-offs

- custo marginal em escrita (manutencao dos indices)
- ganho significativo em leitura para os padroes de acesso atuais

---

## 18. Limite maximo de paginacao

### Decisao

`PaginacaoDto` limita `porPagina` entre 1 e 100 com `@Min(1)` e `@Max(100)`.

### Justificativa

Previne queries sem limite que podem degradar performance ou ser usadas como vetor de DoS.

### Trade-offs

- clientes que precisem de mais de 100 registros por pagina devem paginar
- o default continua sendo 20

---

## 19. Precisao financeira: Decimal no banco e number no dominio

### Decisao

Valores monetarios sao armazenados como `Decimal(10,2)` no PostgreSQL. A conversao para `number` do JavaScript e feita nos repositorios via `Number()`. Value objects de orcamento usam `.toFixed(2)` para arredondar resultados aritmeticos.

### Justificativa

Para a escala do MVP (valores ate 99.999.999,99), `Number` do JavaScript (IEEE 754 double) consegue representar todos os valores de `Decimal(10,2)` sem perda. Adotar `Decimal.js` na camada de dominio exigiria refatoracao de todas as entidades, value objects e use cases.

### Trade-offs

- se o produto crescer para escala financeira com muitas casas decimais, sera necessario migrar para Decimal.js
- para o uso atual (oficina mecanica), o arredondamento via `.toFixed(2)` nos VOs e suficiente

---

## 20. Bootstrap do primeiro administrador via seed

### Decisao

`POST /api/v1/usuarios` exige papel `ADMINISTRADOR`, criando um problema de bootstrap. O repositorio resolve isso com um script de seed (`prisma/seed.ts`) que insere o primeiro admin diretamente no banco.

### Justificativa

Manter a rota de criacao de usuario protegida e a escolha correta de seguranca. O seed e a forma controlada de resolver o bootstrap sem expor a rota publicamente.

### Trade-offs

- o seed depende de acesso direto ao banco
- credenciais do admin seed estao no codigo-fonte e devem ser trocadas em producao
- o script e idempotente e pode ser re-executado sem duplicar dados

---

## 21. Serializacao de IDs como value objects nas respostas HTTP

### Decisao

Controllers retornam entidades de dominio diretamente. Como `id` e um value object (`IdUnico` com propriedade `valor`), as respostas JSON serializam IDs no formato `{ valor: "xx01..." }` em vez de string plana.

### Justificativa

Evita criar DTOs de resposta para todas as entidades durante o MVP. A camada de dominio permanece intacta.

### Trade-offs

- clientes HTTP precisam acessar `id.valor` em vez de `id` diretamente
- a collection Postman trata ambos os formatos nos scripts de teste
- futuramente, DTOs de resposta podem normalizar para string plana

---

## 22. Collection Postman versionada no repositorio

### Decisao

O repositorio inclui uma collection Postman em `postman/` com o fluxo completo do roteiro manual, incluindo scripts de captura automatica de IDs e tokens.

### Justificativa

Reduz o atrito para validar o fluxo ponta a ponta enquanto nao existe e2e automatizado com banco real.

### Trade-offs

- a collection precisa ser atualizada manualmente quando endpoints mudam
- nao substitui testes automatizados

---

## 23. Desativacao e reativacao de ServicoOficina

### Decisao

O catalogo de servicos agora expoe dois endpoints administrativos:

- `PATCH /api/v1/servicos-oficina/:id/desativar`
- `PATCH /api/v1/servicos-oficina/:id/ativar`

Ambos sao restritos a `ADMINISTRADOR`. A operacao e idempotente no sentido de persistencia, mas retorna erro de regra de negocio se o servico ja esta no estado alvo.

### Justificativa

A entidade ja possuia o campo `ativo` e o metodo `desativar()`, mas nao existia endpoint HTTP nem metodo `ativar()` para reverter a desativacao. Servicos desativados deixam de aparecer na listagem (que filtra `ativo: true`) e nao podem ser selecionados em novas OS.

### Trade-offs

- OS existentes que referenciam um servico desativado nao sao afetadas (o snapshot em `ServicoSolicitado` preserva o nome)
- nao ha endpoint de delete fisico, apenas desativacao logica

---

## 24. Sintese

O estado atual do repositorio prioriza:

- modelo de dominio claro
- ownership de cliente tecnicamente consistente
- consistencia transacional no consumo de pecas
- historico rico para auditoria e analiticos
- operacao simples em ambiente local

Os principais gaps remanescentes sao:

- e2e automatizado completo com banco real
- analiticos ainda calculados em memoria
- DTOs de resposta para normalizar IDs como string plana
