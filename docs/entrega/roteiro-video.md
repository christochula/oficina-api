# Vídeo da Fase 4 — roteiro de 14min30s

Limite: **15 minutos**. Participantes: **Matheus Chula** e **Karina Lage**. RMs e link do vídeo permanecem pendentes em [entrega.json](../fase4/entrega.json).

Este roteiro substitui o da Fase 3: são **três microsserviços de negócio e seis repositórios**. Antes de gravar, abrir [pronto para gravar](pronto-para-gravar.md), o [checklist](checklist-gravacao.md) e, se repetir o fluxo, o [guia de nova OS](nova-os-demonstracao.md).

## Evidência preservada

O ensaio de **10/11/2026 em São Paulo** concluiu a OS **#2**, ID **os06a521bf-0d80-49b5-8dd2-1a1c9c961588**, com orçamento **R$175**, compensação por falta de estoque, reposição, nova Saga, reparo, Checkout Pro entre contas TEST e entrega. Resultado: **ENTREGUE**, pagamento **APPROVED**, **paymentConfirmed=true**. Saga compensada: **57dccf1d-8f9d-4d2d-93ce-099c823d1264**; recuperação: **c5469a88-8b2b-4503-a146-e3db319485fd**, preparação COMPLETED antes do reparo.

A OS **#1**, ID **os9dbdff80-b24f-4805-9ccf-f432d84c4d7c**, permanece entregue como histórico de **06/11/2026**. Os links dos dois snapshots estão no [README](../../README.md#homologação-e-evidências-da-fase-4). Preserve ambas.

A linha do tempo abaixo usa o fluxo real ensaiado da **OS #2**: identificar capturas e mostrar seu histórico em ordem. Se o grupo optar por repetir ao vivo, criar uma única nova OS pela interface — a próxima será #3 se nenhuma outra for criada — e usar seu número/ID em todas as etapas. Não misturar a nova execução com o pagamento ou histórico da OS #2.

## Abas preparadas

Portal com sessões separadas de administrador, mecânico e cliente; [arquitetura Fase 4](../fase4/arquitetura.md); seis repositórios; CI/deploy do SHA demonstrado; Datadog com filtros e período corretos. Comprador Mercado Pago TEST distinto do vendedor TEST, mesmo país, já validado em sessão isolada da conta real. O token do cliente dura **5 minutos**: entrar novamente antes do trecho de pagamento. Manter senhas, documento e verificação de conta fora da captura.

## Linha do tempo

| Tempo | Tela e ação | Evidência/fala principal |
|---|---|---|
| 00:00–00:40 | Apresentação e links | “Somos Matheus Chula e Karina Lage. Esta é a Fase 4 da Oficina: três microsserviços, Saga e deploy Kubernetes automatizado.” |
| 00:40–01:40 | Diagrama | OS/orquestrador com PostgreSQL; Billing/orçamento e pagamento com outro PostgreSQL; Production/diagnóstico, estoque e execução com DynamoDB. SQS/DLQs; EKS compartilhado; nenhum banco acessado por outro serviço. |
| 01:40–02:20 | OS #2 entregue e histórico | Mostrar R$175 e execução de 10/11. OS #1 de 06/11 permanece como histórico separado. |
| 02:20–03:30 | Admin: abertura e atribuição | Mostrar os dados fictícios da OS demonstrada, filial-sp e vínculo do mecânico. Se repetir ao vivo, anotar a nova OS; aguardar “Preparando atendimento” terminar e depois ATRIBUIDA/responsável correto no admin antes de mudar de perfil. |
| 03:30–04:45 | Mecânico: diagnóstico e orçamento | Serviço R$100 + filtro R$50 + junta R$25, quantidade 1 cada. Total R$175 e AGUARDANDO_APROVACAO. |
| 04:45–06:15 | Cliente: aprovação; histórico/estoque | A peça de R$25 começa indisponível. Mostrar falha de preparação, Saga COMPENSATED e reservas liberadas. A OS permanece aprovada. |
| 06:15–07:30 | Admin: reposição e retry | Entrada de 1 unidade da peça faltante, mesma filial. “Tentar preparação novamente”; outra sagaId, preparação COMPLETED e orçamento preservado. |
| 07:30–08:45 | Mecânico: reparo | Iniciar execução, consumir 1 unidade de cada material e finalizar. AGUARDANDO_PAGAMENTO; entrega ainda bloqueada. |
| 08:45–10:15 | Cliente: checkout; admin: entrega | “Pagar OS”, concluir com comprador/cartão TEST e voltar à mesma OS. Mostrar APPROVED, confirmação, PRONTA_PARA_ENTREGA e entrega → ENTREGUE. |
| 10:15–11:55 | CI/Sonar/deploy/EKS | Testes unitários, BDD e Playwright, cobertura ≥80% por serviço e quality gate. Run concluído: build → ECR → Helm/migração → rollout; SHA/imagem, pods prontos e health. Pipelines independentes, PR/checks obrigatórios. |
| 11:55–14:00 | Datadog | Abrir o trace 6af3b4f30000000061b75976960c6fe6 com os três serviços em parte do fluxo. Mostrar compensação/recuperação, log de webhook e PaymentConfirmed, 7 séries Saga, p95 dos três serviços e filas/DLQs. Não prometer um trace para toda a Saga ou indexação de cada transição. |
| 14:00–14:30 | Encerramento | Retomar seis repositórios, arquitetura e fluxo entregue; PDF com participantes, links, vídeo e justificativa da Saga. |

## Explicações curtas

- **Auth:** Lambda consulta a API OS por HTTPS com token interno para emitir JWT de cliente; não acessa banco. Gateway e backends aplicam autenticação e autorização/ownership. Lookup interno e webhook têm verificações próprias.
- **Saga:** orquestração persistente no OS, inbox/outbox, deduplicação e compensações. Retry cria nova Saga e preserva o orçamento aprovado.
- **Fronteira física:** antes do reparo, reservas podem ser desfeitas. Reparo concluído não é apagado por pagamento recusado; cobrança permanece pendente e entrega bloqueada.
- **Pagamento:** Billing valida assinatura e consulta o recurso canônico no Mercado Pago, conferindo referência, valor e moeda. PaymentConfirmed libera a entrega; o redirect sozinho não basta.

## Esperas e cortes

Ensaiar antes. Cortar apenas espera/digitação, preservando cronologia e ID. Identificar capturas históricas; não apresentar simulador local como Mercado Pago nem configuração Datadog como ingestão real. Mostrar somente traces/monitores efetivamente verificados.

O deploy pode ser um run anterior concluído, com testes e SHA correspondentes; não é necessário disparar outro só para preencher o vídeo. A sessão Academy iniciada em 10/11 às 20:44 termina em **11/11/2026 às 00:44:36 de São Paulo**. Reconferir a sessão antes de gravar; após renovação, usar os workflows para eventuais atualizações de credenciais/rollout.

No ensaio da OS #2, o recurso canônico do provedor confirmou **approved, R$175 BRL**, vendedor e comprador TEST esperados e **live_mode=true**. Registrar esses fatos sem afirmar live_mode=false ou concluir movimentação financeira apenas pela flag. O fluxo usa Preferences e init_point.

Se ultrapassar 14min30s, reduzir abertura/digitação/leitura de tabelas. Preservar: três serviços, compensação e recuperação, pagamento após reparo, CI/deploy com testes e rastreamento real. Nunca exibir JWT, senhas, chaves, MFA, connection strings ou Terraform state.
