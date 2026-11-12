# Validação local da Fase 4

## Candidato revisado em 12/11/2026

Resultados do workspace local após a implementação B01–B15 e revisão dos contratos publicados. Não representam execução de CI remoto, deploy, Sonar ou pagamento externo. Os registros históricos abaixo e os links de CI dos READMEs permanecem ligados às versões e datas originais.

| Componente | Nova verificação do candidato | Cobertura statements / branches / functions / lines |
|---|---|---|
| OS Service | 97 suítes / 672 testes; formato, lint e build aprovados | 95,70% / 85,27% / 93,37% / 96,28% |
| Billing | 9 suítes / 92 testes; lint/typecheck e build aprovados | 99,20% / 93,25% / 97,89% / 99,71% |
| Production | 9 suítes / 112 testes; typecheck e build aprovados | 100% / 96,94% / 100% / 100% |
| Frontend | 148 testes; lint e build aprovados | Não foi medida cobertura frontend nesta rodada |
| Contratos publicados | 10 verificações aprovadas; 53 rotas, 34 schemas e 25 requisições na collection | Referências, exemplos, privacidade e compatibilidade validados |
| Scripts API e simulador | 61 testes aprovados, incluindo preflight de conta com operações simuladas | Não executam provisionamento real |
| Scripts de plataforma | 61 testes aprovados, incluindo guard de conta com AWS stub | Não executam provisionamento real |
| Workflows | Actionlint aprovado nos 16 workflows dos seis repositórios | Validação estática; não executa Actions, ShellCheck ou Pyflakes |

Os quatro gates de cobertura de cada serviço continuam acima de 80%. O lint da API terminou sem erros, com 12 avisos `no-unsafe-call` nos testes dos repositórios SQL de catálogo. Não houve mudança de fonte da aplicação nesta revisão documental. Os testes unitários usam seus mocks/stores isolados; não foram executados seed, reinício de serviço nem mutações nas OS da demonstração.

Logs, comandos, exit codes e cobertura desta rodada estão em `output/video-readiness/engineering/`: `api-gates.json`, `billing-gates.json`, `production-gates.json`, `frontend-gates.json`, `contract-checks.json` e as pastas `*-coverage/`. São artefatos locais ignorados pelo Git, não links de publicação nem conteúdo garantido em um clone.

### Contratos de API revisados

O [OpenAPI](openapi.json) usa a base `/api/docs-json` extraída do runtime distribuído local e complementa as respostas agregadas e os parâmetros declarados como tipos inline/`Record` nos controllers. A geração automática por decorators, sozinha, não descreve essas respostas. Preservar essa complementação editorial ao atualizar o snapshot; os contratos foram conferidos com `src/phase4/{controller,service,contracts}.ts`, o filtro HTTP e o participante Production. O Swagger servido pela aplicação não foi alterado por esta revisão.

- Busca global de estoque, OS, veículos e serviços precede paginação e preserva autorização. Código da peça é contextual à filial.
- Peças solicitadas recebem identidade validada e snapshots; só administrador envia uma seleção não vazia. Solicitar não reserva estoque; OS legadas sem esse campo permanecem compatíveis.
- Grupos/notas do orçamento sobrevivem à versão e à leitura. Cliente não recebe notas internas, faltas de estoque nem consumo operacional; consultor não recebe disponibilidade nas faltas.
- `consumosPeca` apresenta reservado/consumido/restante por OS. Excesso devolve HTTP 400 definitivo com `QUANTITY_EXCEEDS_RESERVATION` e quantidades; resultado incerto exige repetir o mesmo `operationId` e payload. UUID é opcional no contrato por compatibilidade, mas necessário ao fluxo seguro de repetição.
- `AGUARDANDO_PAGAMENTO` pode preceder a disponibilidade de `checkoutUrl`; a interface espera a preparação do link.

A [collection Postman](oficina-fase4.postman_collection.json) contém consultas por perfil, orçamento com grupos/notas, peças solicitadas e consumo com recibo. Tokens ficam vazios e as bases padrão apontam às portas locais isoladas 3100/3101/3102. Executar requisições individualmente em fixtures próprios: a collection inclui mutações e não foi executada em lote. Valores da fachada OS são reais; no Billing direto são centavos. O contrato direto antigo de orçamento somente com `items` continua aceito.

As verificações de esquema usam as respostas reais já preservadas de três OS entregues, da preparação compensada e do excesso HTTP 400; também rejeitam exemplos com vazamento de notas internas/consumo no schema público. Elas não criam uma nova jornada de negócio nem substituem testes HTTP e E2E.

### Reauditoria integrada concluída anteriormente em 12/11/2026

| Conjunto | Resultado registrado |
|---|---|
| BDD distribuído | 3 cenários / 16 passos |
| API E2E legado | 2 suítes / 6 testes em PostgreSQL temporário |
| Recuperação API | 10 cenários aprovados, incluindo concorrência, resposta perdida e duas filiais |
| Retomada, catálogos e consultor | 25 cenários aprovados, consolidados por fonte válida |
| Desktop | 12 combinações de cenário/resolução aprovadas, incluindo preparação e rejeição |
| Resiliência com reinícios | 9 cenários aprovados, sem skip; intervenção desktop adicional aprovada |
| Rotina principal | Três OS entregues, uma em cada resolução: 1920×1080, 2560×1440 e 3840×2160; R$175 e zero transcrições de UUID por jornada |

Fonte local: `output/desktop-review-ux-implementation/RELATORIO-FINAL.md`, `validation-summary.json` e manifests vinculados. As tentativas anteriores falhas permanecem preservadas, inclusive a corrida de checkout corrigida antes da OS76. Nesta revisão documental o BDD não foi repetido: seu setup executa seed e cria dados nos serviços compartilhados; repetição deve ser coordenada em ambiente isolado. Esses resultados integrados não devem ser apresentados como executados novamente pelos checks de engenharia acima.

## Registro anterior à reauditoria UX

Os números a seguir preservam a validação anterior; não são os totais do candidato atual.

| Componente | Resultado |
|---|---|
| OS Service | 551 testes / 95 suítes aprovados; cobertura de todo o runtime ativo |
| Billing | 64 testes aprovados, incluindo HTTP, JWT, persistência, mensageria, pagamento e tracing |
| Production | 63 testes aprovados, incluindo DynamoDB, estoque, HTTP, JWT, mensageria e tracing |
| Auth serverless | 55 testes aprovados; typecheck, lint e build aprovados |
| Portal | 77 testes aprovados, incluindo 11 de autenticação local; lint e build aprovados |
| Checkout de demonstração | 14 testes HTTP aprovados: recusa/aprovação, assinatura, idempotência, recuperação do webhook e persistência após reinício |
| BDD distribuído | 2 cenários / 10 etapas aprovados com três serviços, dois PostgreSQL e DynamoDB/SQS em LocalStack |
| Playwright | Fluxo no Chromium aprovado: aprovação, reparo, checkout, trava de pagamento e entrega |
| Navegador com formulários reais | 1 cenário aprovado: três logins, abertura/atribuição, diagnóstico/orçamento, aprovação por CPF, execução/consumo, recusa e nova tentativa de pagamento, retorno ao portal e entrega |
| Resiliência | 4 cenários aprovados: estoque real, duplicatas, compensação/retry/tardias e reinício real do OS |
| Regressão da Fase 3 | 2 suítes / 6 testes E2E aprovados em PostgreSQL temporário via Testcontainers |
| Infra | Terraform fmt/validate aprovados; Helm lint aprovado; imagens dos três serviços construídas |

Cobertura de OS: [resumo JSON](coverage-summary.json). Os READMEs de Billing e Production incluem seus próprios resumos e comandos. `npm run test:cov -- --runInBand` no OS gera HTML em `coverage/lcov-report/index.html`; o CI publica os relatórios como artefatos. Código histórico de OS/estoque inativo no modo distribuído não compõe a cobertura ativa; os DTOs usados pelo portal continuam incluídos.

Comandos: `npm run test:bdd`, `npm run test:frontend:e2e` e `node --test test/phase4/resilience.cjs`. Para incluir o reinício real do OS no último comando, definir `ALLOW_SERVICE_RESTART=true`. Não executar testes de reinício simultaneamente aos testes do portal.

Para testar manualmente o fluxo, consulte o [roteiro do navegador local](teste-navegador-local.md). O cenário adicional é executado por `npm run test:frontend:manual`, após o seed fictício e com `LOCAL_DEMO_MODE=true`. Ele usa os formulários e o checkout visível, sem injetar sessões nem confirmar pagamentos por helper. A pipeline Frontend executa ambos os cenários do portal.

Foi validada a recuperação de 11 preferências locais com seus IDs originais, preservando os dados de OS/Billing. O checkout anteriormente perdido da OS 25 respondeu HTTP 200 antes e depois de um reinício real do simulador; ID, referência e valor permaneceram iguais, sem aprovar seu pagamento. O Compose mantém o estado do simulador em arquivo montado fora do contêiner.

Os testes do pagamento usam um provedor HTTP simulado local. A assinatura, consulta e conferência do pagamento são exercitadas, mas o pagamento com contas Mercado Pago de teste, SonarCloud, deploy EKS e dashboards Datadog reais permanecem dependentes das configurações externas do grupo. Nenhuma evidência local representa uma execução desses ambientes externos.
