# ADR-009 — Datadog via Agent no cluster, sem integração AWS↔Datadog

- Status: aceita
- Data: 2026-09-03

## Contexto

O desenho original coletava, além do Agent no cluster, métricas do CloudWatch de
API Gateway, Lambda e RDS via `datadog_integration_aws_account` — que cria uma
IAM role assumível pela conta da Datadog (cross-account). Bloqueado no Academy
(ADR-005). O Datadog Operator também dependia de CRDs + IRSA do ESO para as
credenciais.

## Decisão

- **Datadog Agent** instalado pelo Helm chart oficial `datadog/datadog`
  (DaemonSet + Cluster Agent), com a API key vinda de uma variável Terraform
  `sensitive` lida do AWS Secrets Manager pelo pipeline. Sem Operator, sem ESO,
  sem IRSA.
  Coleta: **logs** (containerCollectAll), **APM** (UDS + host port),
  **DogStatsD** (host port 8125), **kube-state-metrics**, live processes.
- **`observability/`** (provider Datadog, rodado no pipeline com
  `DD_API_KEY`/`DD_APP_KEY` do Secrets Manager): 1 dashboard (10 widgets),
  5 monitores de métrica, 1 Synthetic HTTP em `/api/health/ready` (location
  pública), e `datadog_metric_tag_configuration` para os percentis das
  distributions.
- **Sem** `datadog_integration_aws_account` e sem `DatadogIntegrationRole`.

## Consequências

- App e cluster ficam **totalmente cobertos** (logs, traces, métricas de infra
  e de negócio, correlação `correlation_id` ↔ `dd.trace_id`).
- **Não** há métricas nativas de CloudWatch de API Gateway / Lambda / RDS no
  Datadog. As Lambdas têm APM próprio (layers Datadog, opcional via
  `datadog_enabled`); API Gateway e RDS têm logs/insights no CloudWatch.
- A key precisa dos escopos de escrita (dashboards, monitors, synthetics,
  metric tags). Guardada só no Secrets Manager (`oficina/datadog`).
- Restaurar a integração AWS em conta real = `enable_aws_integration = true`
  (código no histórico do `observability/`).
