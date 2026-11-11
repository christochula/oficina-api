# Vídeo da Fase 4 — roteiro de 14min30s

Limite: **15 minutos**. Participantes: **Matheus Chula** e **Karina Lage**. RMs e link do vídeo permanecem pendentes em [entrega.json](../fase4/entrega.json).

Este roteiro substitui o da Fase 3: são **três microsserviços de negócio e seis repositórios**. Antes de gravar, use o [checklist](checklist-gravacao.md) e o [guia de nova OS](nova-os-demonstracao.md).

## Evidência preservada

Em **06/11/2026**, a OS **#1**, ID **os9dbdff80-b24f-4805-9ccf-f432d84c4d7c**, completou abertura, diagnóstico, orçamento de **R$175**, aprovação, compensação por falta de estoque, reposição, nova Saga, reparo, Checkout Pro com contas TEST e entrega. O estado final registrado foi **ENTREGUE**, pagamento **APPROVED**, **paymentConfirmed=true**; o webhook assinado recebeu HTTP201. Os links de CI, Sonar e deploy desse snapshot estão no [README](../../README.md#homologação-e-evidências-da-fase-4).

Preserve a OS #1. Identifique sua data ao mostrar histórico/capturas. Uma demonstração nova terá outro número: mantenha esse ID em todas as etapas, sem misturar telas de ordens diferentes.

## Abas preparadas

Portal com sessões separadas de administrador, mecânico e cliente; [arquitetura Fase 4](../fase4/arquitetura.md); seis repositórios; CI/deploy do SHA demonstrado; Datadog com filtros e período corretos. Comprador Mercado Pago TEST distinto do vendedor TEST, mesmo país, já validado em sessão isolada da conta real.

## Linha do tempo

| Tempo | Tela e ação | Evidência/fala principal |
|---|---|---|
| 00:00–00:40 | Apresentação e links | “Somos Matheus Chula e Karina Lage. Esta é a Fase 4 da Oficina: três microsserviços, Saga e deploy Kubernetes automatizado.” |
| 00:40–01:40 | Diagrama | OS/orquestrador com PostgreSQL; Billing/orçamento e pagamento com outro PostgreSQL; Production/diagnóstico, estoque e execução com DynamoDB. SQS/DLQs; EKS compartilhado; nenhum banco acessado por outro serviço. |
| 01:40–02:20 | OS #1 entregue e histórico | Mostrar R$175 e execução de 06/11. A nova demonstração preserva esse histórico. |
| 02:20–03:30 | Admin: wizard e atribuição | Cliente/veículo existentes, filial-sp e problema fictício. Anotar a nova OS. Aguardar “Preparando atendimento” terminar antes de “Informar mecânico”. |
| 03:30–04:45 | Mecânico: diagnóstico e orçamento | Serviço R$100 + filtro R$50 + junta R$25, quantidade 1 cada. Total R$175 e AGUARDANDO_APROVACAO. |
| 04:45–06:15 | Cliente: aprovação; histórico/estoque | A peça de R$25 começa indisponível. Mostrar falha de preparação, Saga COMPENSATED e reservas liberadas. A OS permanece aprovada. |
| 06:15–07:30 | Admin: reposição e retry | Entrada de 1 unidade da peça faltante, mesma filial. “Tentar preparação novamente”; outra sagaId, preparação COMPLETED e orçamento preservado. |
| 07:30–08:45 | Mecânico: reparo | Iniciar execução, consumir 1 unidade de cada material e finalizar. AGUARDANDO_PAGAMENTO; entrega ainda bloqueada. |
| 08:45–10:15 | Cliente: checkout; admin: entrega | “Pagar OS”, concluir com comprador/cartão TEST e voltar à mesma OS. Mostrar APPROVED, confirmação, PRONTA_PARA_ENTREGA e entrega → ENTREGUE. |
| 10:15–11:55 | CI/Sonar/deploy/EKS | Testes unitários, BDD e Playwright, cobertura ≥80% por serviço e quality gate. Run concluído: build → ECR → Helm/migração → rollout; SHA/imagem, pods prontos e health. Pipelines independentes, PR/checks obrigatórios. |
| 11:55–14:00 | Datadog | Correlacionar osId/sagaId/correlationId nos três serviços, chamadas HTTP e processamento de mensagens disponíveis nos traces. Mostrar logs da compensação e métricas de tráfego, latência/erros, Saga e filas/DLQ da janela escolhida. |
| 14:00–14:30 | Encerramento | Retomar seis repositórios, arquitetura e fluxo entregue; PDF com participantes, links, vídeo e justificativa da Saga. |

## Explicações curtas

- **Auth:** Lambda consulta a API OS por HTTPS com token interno para emitir JWT de cliente; não acessa banco. Gateway e backends aplicam autenticação e autorização/ownership. Lookup interno e webhook têm verificações próprias.
- **Saga:** orquestração persistente no OS, inbox/outbox, deduplicação e compensações. Retry cria nova Saga e preserva o orçamento aprovado.
- **Fronteira física:** antes do reparo, reservas podem ser desfeitas. Reparo concluído não é apagado por pagamento recusado; cobrança permanece pendente e entrega bloqueada.
- **Pagamento:** Billing valida assinatura e consulta o recurso canônico no Mercado Pago, conferindo referência, valor e moeda. PaymentConfirmed libera a entrega; o redirect sozinho não basta.

## Esperas e cortes

Ensaiar antes. Cortar apenas espera/digitação, preservando cronologia e ID. Identificar capturas históricas; não apresentar simulador local como Mercado Pago nem configuração Datadog como ingestão real. Mostrar somente traces/monitores efetivamente verificados.

O deploy pode ser um run anterior concluído, com testes e SHA correspondentes; não é necessário disparar outro só para preencher o vídeo. A disponibilidade do Academy deve ser reconferida na sessão da gravação.

Na execução de 06/11, o provedor retornou **live_mode=true** entre contas TEST. Registrar esse fato sem afirmar live_mode=false ou concluir movimentação financeira apenas pela flag. O fluxo usa Preferences e init_point.

Se ultrapassar 14min30s, reduzir abertura/digitação/leitura de tabelas. Preservar: três serviços, compensação e recuperação, pagamento após reparo, CI/deploy com testes e rastreamento real. Nunca exibir JWT, senhas, chaves, MFA, connection strings ou Terraform state.
