# Validação local — 11/11/2026

Esta rodada evolui a identidade existente e verifica o fluxo distribuído antes da publicação. O ambiente AWS Academy permaneceu desligado; não houve commit, push ou deploy nesta rodada. As alterações estão nos diretórios locais de OS e Production. Billing participou dos testes sem alteração de código.

## Ambiente e reprodução

O portal de demonstração está em **http://localhost:5173**, com os três serviços, PostgreSQL separados, DynamoDB/SQS no LocalStack e checkout simulado. Instruções, portas, credenciais fictícias e comandos de retomada estão no [guia local](../phase4-local.md). O [plano de polimento](polimento-desktop.md) registra as decisões de UI e as ferramentas/skills pesquisadas.

Demonstração e aceitação usam projetos Docker, portas, redes e volumes distintos. Os testes criam seus próprios dados pelas APIs e não alteram dados cloud. O runner de CI reutiliza esse isolamento e publica os relatórios de navegador como artifacts.

Ao encerrar, somente o projeto descartável `oficina-phase4-test-local` foi removido. Demonstração preservada: portal, OS, Billing, Production e simulador responderam HTTP 200 às 09:59 de 11/11/2026, horário de São Paulo. O [resumo consolidado da execução](../../output/desktop-review-final/validation-summary.json) inclui saúde, limpeza e resultados.

## Correções e experiência

- Acompanhamento da OS por consultas limitadas: ação aceita permanece visível enquanto os serviços confirmam o andamento; nenhuma aprovação, preparação, movimentação de estoque ou cobrança é reenviada automaticamente. Uma etapa já ultrapassada por outro perfil também encerra a espera.
- Preparação compensada explica a reposição na filial antes de tentar novamente. Intervenção administrativa tem estado próprio e exige confirmação. Atualizar andamento consulta o estado, sem disparar nova Saga.
- Perda da resposta de consumo preserva uma tentativa com `operationId`. O frontend reutiliza a mesma chave e conteúdo após fechar/reabrir a janela ou recarregar a página. Production registra o recibo na mesma transação de estoque, ordem e outbox: a repetição não consome novamente. Outra carga com a mesma chave retorna conflito.
- Consulta transitória malsucedida preserva o contexto e bloqueia comandos até uma leitura bem-sucedida. Login expirado permite voltar à mesma OS. Pagamento confirmado e ainda em propagação impede um novo pagamento.
- Hierarquia visual, tipografia, navegação, tabelas, formulários e modais refinados para 1080p, 1440p e 4K. Orçamento mostra total em tempo real; consumo seleciona peças do orçamento. Estoque mostra filial e reservas; busca aceita UUID completo e ignora respostas antigas.
- Dashboard distingue preparação concluída, pagamento pendente e retirada liberada. A identidade azul, marca e stack Vite/Tailwind/JavaScript foram preservadas.

## Testes unitários e integração

| Verificação | Resultado |
|---|---|
| OS — Jest | 655 testes, 96 suítes aprovadas |
| Billing — Jest | 82 testes, 9 suítes aprovadas |
| Production — Jest | 98 testes, 8 suítes aprovadas |
| Frontend — Node Test | 135 testes aprovados após os ajustes finais de acompanhamento e compatibilidade legada |
| Integração PostgreSQL do OS em modo legado (`PHASE4_ENABLED=false`) | 6 testes, 2 suítes aprovadas |
| Simulador Mercado Pago | 15 testes aprovados |
| Configuração/isolamento do runner local | 6 testes aprovados; resolução do npm também conferida em Node 22/Linux |

A integração legada acima roda com `PHASE4_ENABLED=false`, sem substituir os testes distribuídos da seção seguinte. Lint, formatação aplicável, build/typecheck e geração do Swagger passaram nos componentes alterados. O workflow alterado passou no actionlint. O `git diff --check` dos arquivos de código passou; os avisos de normalização LF/CRLF no Windows não representam falha de teste.

| Serviço | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| OS | 95,95% | 85,91% | 93,40% | 96,48% |
| Billing | 99,15% | 92,37% | 97,82% | 99,68% |
| Production | 100% | 98,67% | 100% | 100% |

Os relatórios de cobertura estão em `coverage/` de cada serviço. Os logs locais são evidência da execução nesta máquina; não são resultados de um novo GitHub Actions ou Sonar remoto.

## BDD e falhas distribuídas

BDD: **3 cenários e 16 passos aprovados** na repetição final com o backend atualizado, usando bancos, mensageria e serviços reais em containers. Somente o provedor de pagamento é simulado. Evidência: [JSON BDD](../../output/desktop-review-final/bdd-report.json) e [log](../../output/desktop-review-final/bdd.log).

A suíte de resiliência foi repetida integralmente no backend final: **9/9 casos aprovados em 6min16s**, sem skips, falhas ou cancelamentos. [Log completo](../../output/desktop-review-final/resilience.log) e [resumo das integrações](../../output/desktop-review-final/integration-summary.json) preservam o resultado. Os casos incluem:

- Estoque insuficiente, duplicações e eventos de Saga atrasados.
- Três retentativas consecutivas sem a peça: cada tentativa compensa, libera reservas e preserva o orçamento; reposição na mesma filial permite preparar a mesma OS com nova Saga.
- Duas OS concorrendo pela última peça: apenas uma prepara, a outra compensa, sem estoque negativo.
- Reinício do orquestrador com mensagens pendentes e recuperação posterior.
- Indisponibilidade real de Production: intervenção, controle de papel e Saga esperada, reconciliação e nova preparação após reposição.
- Pagamento confirmado enquanto OS está indisponível: processamento após retorno libera a OS uma única vez.
- Consumo concorrente/repetido, reinício de Production, divergência de payload, consumo seguinte legítimo e replay após conclusão: recibo persistente sem duplicar efeitos.

## Navegador desktop

A matriz completa passou: **11/11 casos em 9min30s**, sem skips, resultados inesperados ou testes instáveis. Foram produzidas **64 capturas e 64 auditorias axe**, sem violações detectadas nas regras WCAG 2 A/AA e 2.1 AA aplicadas. As verificações também cobriram overflow horizontal e erros inesperados do navegador.

| Resolução | Casos aprovados |
|---|---|
| 1920×1080 | Galeria de dez páginas, fluxo completo, retentativas/estoque, intervenção real e consumo com resposta perdida |
| 2560×1440 | Galeria de dez páginas, fluxo completo e retentativas/estoque |
| 3840×2160 | Galeria de dez páginas, fluxo completo e retentativas/estoque |

Os fluxos usam logins reais dos perfis locais e os serviços em containers. Verificam a atualização do status na tela após atribuição, diagnóstico, orçamento, execução e finalização, sem usar reload para esconder atraso da projeção. O pagamento recusado mantém a entrega bloqueada; a aprovação simulada e seu webhook liberam a mesma OS.

Evidências locais: [relatório HTML](../../output/phase4-desktop-report/index.html), [JSON da execução](../../output/phase4-desktop-report.json) e [resumo consolidado](../../output/desktop-review-final/desktop-summary.json). Os screenshots estão em `output/phase4-desktop/`. Esses arquivos são ignorados pelo Git; o workflow guarda os relatórios como artifacts.

A revisão visual identificou e corrigiu um último ajuste de espaçamento no campo de busca do wizard. Após essa correção, passaram **6/6 verificações complementares**: galeria de dez páginas e modal de atribuição em cada uma das três resoluções, com **33 capturas e 33 auditorias axe sem violações detectadas**. [HTML complementar](../../output/desktop-review-final-css/report/index.html) e [JSON complementar](../../output/desktop-review-final-css/report.json) preservam essa execução separadamente da matriz original. As capturas finais foram inspecionadas visualmente nas três resoluções.

O ajuste final de compatibilidade também reconhece `FINALIZADA` ao acompanhar a conclusão no modo legado, coberto pela suíte frontend de 135 testes. O contrato de pagamento da Fase 4 permanece obrigatório para a entrega.

O smoke de navegador utilizado pelo CI também foi repetido após esses ajustes: **1/1 aprovado** ([JSON](../../output/desktop-review-final/portal-smoke.json)).

## Roteiro e publicação posterior

O roteiro de gravação recebeu somente os ajustes de telas/comportamentos desta rodada: total do orçamento, acompanhamento, filial/reservas, seleção de peças e confirmação de pagamento. A linha do tempo e o voice-over foram preservados. As telas novas só aparecerão na AWS após a publicação e o deploy posteriores.

Ordem de publicação necessária:

1. Publicar e validar Production com suporte ao `operationId` opcional. O contrato continua compatível com clientes antigos e não exige migração do DynamoDB.
2. Fixar `PRODUCTION_CI_REF` do OS no commit compatível, ou disponibilizá-lo na `main`. Para execução manual, o workflow também aceita `production_ref`.
3. Publicar OS/frontend e executar seus checks distribuídos contra essa versão. O Production antigo rejeita o campo novo; por isso, o backend compatível deve preceder o frontend também no deploy.
4. Quando o Lab voltar, validar rollout, fluxo Mercado Pago TEST real, Gateway e observabilidade antes da gravação definitiva.

O roteiro rastreado foi sanitizado: as senhas preenchidas em trabalho anterior permanecem em `docs/entrega/roteiro-video.local.md`, ignorado pelo Git. A versão publicável orienta a consultar essa cópia fora da captura. Revisar explicitamente os arquivos ao preparar os commits, incluindo os módulos/testes novos; relatórios e capturas permanecem fora do Git e podem ser publicados como artifacts após revisão.

## Limites e pendências explícitas

- Mercado Pago real, EKS, Gateway, Datadog e quality gate remoto não foram revalidados nesta rodada local.
- Não foram executados cenários mobile; a matriz é desktop, nas três resoluções solicitadas.
- Testes axe e navegação por teclado ajudam a detectar regressões, mas não certificam acessibilidade completa. Capturas não são comparações automáticas de pixels entre Windows e Linux.
- O LocalStack 4.10 preservou DynamoDB nos ensaios de reinício, mas não SQS. `local:stop` mantém esse container ativo. Encerrar Docker Desktop durante um fluxo pendente não reproduz a durabilidade do SQS na AWS.
- A [auditoria de dependências](auditoria-dependencias-local.md) encontrou alertas preexistentes, inclusive altos/críticos. Não foram ocultados nem corrigidos com atualização indiscriminada nesta rodada. A manutenção de segurança continua necessária antes de tratar o conjunto como pronto para produção.
