# Datadog na Fase 4: sinais e validação

**Ingestão e ensaio de negócio verificados em 10/11/2026 à noite, em São Paulo (11/11 em UTC).** Há APM, logs, métricas Saga/p95 e um trace com os três serviços para parte do fluxo da OS #2. A evidência não afirma indexação de cada transição nem um trace único para toda a espera humana da Saga.

## Evidência verificada

- [Dashboard de homologação](https://app.datadoghq.com/dashboard/u6t-x9c-awx/oficina--operao-e-observabilidade--homolog), env:homolog.
- Consulta APM retornou **199 spans OS, 236 Billing e 185 Production**. São contagens de spans na amostra, não de traces distintos nem comprovação de que todos compartilham um trace.
- Logs recebidos dos três serviços: 672 OS, 264 Billing e 64 Production na amostra.
- Métrica HTTP com **3 séries**; gauges de fila com **6 séries**, correspondentes a 3 inboxes e 3 DLQs. As DLQs mostraram zero, sem mensagens artificiais.
- A consulta inicial precedeu o ensaio e ainda não retornava séries Saga. Após o fluxo da OS #2, consultas retornaram **7 séries Saga**, com sinais de compensação/recuperação e logs dos três serviços.
- [Apply de infraestrutura 42929602706](https://github.com/christochula/oficina-infra-kubernetes/actions/runs/42929602706), SHA 84c6494; [deploy OS](https://github.com/christochula/oficina-api/actions/runs/42929328275), SHA af93d83; [deploy Billing](https://github.com/christochula/oficina-billing-service/actions/runs/42928569648), SHA 2335; [deploy Production](https://github.com/christochula/oficina-production-service/actions/runs/42928627925), SHA 7daa.

No ensaio, a OS **#2**, `os06a521bf-0d80-49b5-8dd2-1a1c9c961588`, terminou **ENTREGUE**, R$175, pagamento APPROVED e paymentConfirmed=true. A Saga `57dccf1d-8f9d-4d2d-93ce-099c823d1264` foi COMPENSATED; o retry `c5469a88-8b2b-4503-a146-e3db319485fd` concluiu a preparação e o fluxo prosseguiu por reparo, pagamento e entrega.

- O trace **6af3b4f30000000061b75976960c6fe6** contém spans OS/Billing/Production de parte do fluxo. Outros trechos aparecem em traces distintos; não se afirma que cada transição esteja indexada.
- Logs recebidos dos três serviços incluem compensação e conclusão. O evento `billing.payment.checked`, source:webhook, ocorreu em **11/11 00:43:09.702 UTC**; o OS registrou PaymentConfirmed em **00:43:09.955 UTC** (10/11 21:43 em São Paulo).
- Em **11/11 00:40:38 UTC**, a consulta p95 retornou status ok e **3 séries**, uma por serviço, com pontos observados aproximadamente entre **2 e 5ms**. É uma amostra do tráfego daquele período, sem conclusão de SLA ou benchmark.
- [Apply de percentis 42932263134](https://github.com/christochula/oficina-infra-kubernetes/actions/runs/42932263134), SHA 917a94e, após [plano 42931855935](https://github.com/christochula/oficina-infra-kubernetes/actions/runs/42931855935): nenhuma alteração AWS e duas configurações de métricas Datadog.

Reconferir período, serviços e versões na gravação. O [guia pronto para gravar](../entrega/pronto-para-gravar.md) reúne os links e IDs; snapshots comprovam o momento observado, sem garantir disponibilidade futura.

## Implantação e escopo

Seguir [Datadog por GitHub Actions](https://github.com/christochula/oficina-infra-kubernetes/blob/feature/phase4-distributed/docs/datadog-actions.md) e a [preparação deste repositório](datadog-setup.md). As entradas pertencem ao **Environment homolog**; o secret canônico é **oficina/datadog**. Plano/apply e sincronização do Secret Kubernetes são executados por Actions, com revisão de texto/fingerprint do mesmo SHA.

O Agent é instalado via Helm como DaemonSet, acompanhado de Cluster Agent, no namespace datadog. O chart Datadog 3.270.0 também instalou um Deployment do Operator como dependência; não aplicamos um recurso DatadogAgent para implantar o Agent nem habilitamos SSI. Aplicações em oficina-fase4 enviam APM/DogStatsD ao IP do node e logs JSON por stdout. O Academy não disponibiliza a integração AWS cross-account para métricas CloudWatch; a ingestão dos aplicativos não comprova observabilidade de RDS, Gateway ou Lambda no Datadog.

Serviços: **oficina-api**, **oficina-billing-service** e **oficina-production-service**, todos com env:homolog e version correspondente à imagem. O portal, APIs e healths públicos usam o mesmo Gateway HTTPS; API_BASE_URL deve apontar para ele, não para um ELB HTTP antigo.

## Tags e correlação

Tags de métricas são de baixa cardinalidade: env, service, version, status/step/outcome e basename da fila. Não usar CPF, JWT, e-mail, placa, texto do diagnóstico, osId ou correlationId como tag de métrica.

IDs de OS/Saga/correlação podem aparecer como atributos de logs e spans: correlation_id nos logs e os.id, saga.id, correlation.id nos spans customizados. dd.trace_id/dd.span_id existem quando há span ativo. O tracing propaga contexto por HTTP e no envelope SQS; cada processamento tem sua própria duração. Esperas humanas não devem ser apresentadas como um único span contínuo.

No [Trace Explorer](https://app.datadoghq.com/apm/traces), selecionar a janela **11/11/2026 00:15–00:50 UTC** (10/11 21:15–21:50 São Paulo) e pesquisar:

```text
env:homolog trace_id:6af3b4f30000000061b75976960c6fe6
env:homolog @os.id:os06a521bf-0d80-49b5-8dd2-1a1c9c961588
```

`trace_id` é atributo reservado; atributos customizados usam `@`, conforme a [sintaxe oficial](https://docs.datadoghq.com/tracing/trace_explorer/query_syntax/). O Live Search cobre uma janela móvel de 15 minutos; buscas anteriores dependem dos spans indexados pelos filtros de retenção. A retenção documentada varia conforme o filtro, e só spans indexados são pesquisáveis fora do Live. Reconferir as configurações da conta; não garantir presença futura de todo span ou um SLA de retenção para esta demonstração. Ver [Trace Explorer](https://docs.datadoghq.com/tracing/trace_explorer/) e [Trace Retention](https://docs.datadoghq.com/tracing/trace_pipeline/trace_retention/).

## Contrato de métricas

| Métrica | Tipo | Uso na Fase 4 |
|---|---|---|
| oficina.api.request.duration_ms | distribution | Latência HTTP por serviço/método/status |
| oficina.service_orders.created | count | Abertura de OS |
| oficina.service_orders.status_transition | count | Mudança persistida de status |
| oficina.service_orders.status_duration_ms | distribution | Diagnóstico e execução; a etapa finalizacao do fluxo legado não é prova de métrica ativa da Fase 4 |
| oficina.service_orders.processing_errors | count | Falhas de processamento |
| oficina.integrations.errors | count | Erros de integrações |
| oficina.saga.transitions / oficina.saga.compensations | count | Transições reais e compensações persistidas |
| oficina.saga.pending_age_seconds | gauge | Idade das etapas automáticas pendentes |
| oficina.messaging.processed / oficina.messaging.failed | count | Processamento/erros dos consumidores |
| oficina.messaging.queue.visible | gauge | Mensagens aproximadas disponíveis, inclusive DLQ |
| oficina.messaging.queue.inflight | gauge | Mensagens aproximadas em processamento |
| oficina.messaging.queue.delayed | gauge | Mensagens aproximadas atrasadas |

O coletor de filas no OS consulta INBOX_QUEUE_URL, BILLING_QUEUE_URL e PRODUCTION_QUEUE_URL a cada 30s, descobre DLQs pela RedrivePolicy e valida conta/região/ARN antes de consultar. Só usa GetQueueAttributes, sem consumir mensagens; não exporta idade da mensagem mais antiga. Falhas de coleta geram log genérico e não fabricam zeros.

Para DLQ, usar **max**, evitando somar a mesma fila observada pelas duas réplicas OS:

```text
max:oficina.messaging.queue.visible{env:homolog,role:dlq} by {queue}
max:oficina.messaging.queue.inflight{env:homolog,role:dlq} by {queue}
```

Para taxa/volume de consumidores, usar as métricas count com as_count(), filtradas por serviço/fila. A configuração dos percentis foi aplicada após a primeira ingestão pelo plano/apply referenciado acima; novas métricas podem exigir configuração e novo plano revisado. Nomes/limiares de dashboards e monitores vêm do stack observability, não de uma lista histórica fixa.

## Validação pós-deploy

1. **Recursos:** conferir DaemonSet, Cluster Agent e pods de aplicação. Comandos abaixo são de leitura; presença de pods não prova ingestão externa.

```sh
kubectl -n datadog get daemonsets,deployments,pods
kubectl -n datadog rollout status daemonset/datadog --timeout=5m
kubectl -n datadog rollout status deployment/datadog-cluster-agent --timeout=5m
kubectl -n oficina-fase4 get deployments,pods --show-labels
```

2. **Healths:** abrir no Gateway HTTPS /api/health/ready, /api/v1/billing/health e /api/v1/production/health. Gerar tráfego pelo portal com cadastros fictícios.
3. **Métricas:** selecionar env:homolog e o período do tráfego. Conferir os três services, HTTP e mensageria. Duração de diagnóstico/reparo só aparece após essas transições.
4. **Logs/traces:** localizar uma chamada e seus processamentos SQS com a mesma OS/Saga/correlação. Abrir traces e confirmar spans HTTP, chamadas aos serviços/bancos e consumidores efetivamente observados. Não mostrar headers bearer ou payloads pessoais na gravação.
5. **Falha controlada:** usar falta de estoque pelo [guia de demonstração](../entrega/nova-os-demonstracao.md); verificar compensação/recuperação. Não substituir credenciais válidas, derrubar pods ou enviar mensagens artificiais à DLQ apenas para obter um alerta.
6. **Evidência:** guardar data, links do dashboard/logs/traces, serviços/versões e IDs não secretos. Só depois registrar ingestão como comprovada. Uma DLQ com gauge zero é informação válida; não precisa provocar mensagens de erro.

## Diagnóstico rápido

| Sintoma | Verificar |
|---|---|
| Traces ausentes | dd-trace inicializado antes do Nest, flags, IP do node, TCP8126 e Agent |
| Logs sem trace ID | JSON, span ativo, configuração de coleta/correlação |
| Métricas ausentes | DD_METRICS_ENABLED, DD_AGENT_HOST, UDP8125, site e tags |
| DLQ customizada sem pontos | Coletor habilitado, permissão GetQueueAttributes, URLs e RedrivePolicy válidas; não esperar aws.sqs.* sem integração AWS |
| Pods não vistos | DaemonSet/Cluster Agent, RBAC, tolerations e estado dos nós |
| Painel vazio | Janela/env/service, tráfego real, atraso de ingestão e contrato da query |
| Percentil ausente | Distribution ingerida e configuração de tags/percentis aplicada por plano revisado |

