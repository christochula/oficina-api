# Datadog — o que fazer fora do código

O que já está pronto no código está listado em `datadog.md`. Este documento é só
a parte **manual** (não automatizável): criar a conta e as chaves.

Tempo: ~5 min. Fazer **antes** ou **durante** a sessão de deploy.

---

## 1. Conta

1. https://www.datadoghq.com/ → **Free Trial** (14 dias, sem cartão).
   Cobre APM, logs, métricas, dashboards, monitores e Synthetics — suficiente
   para a entrega (prazo dia 15).
2. Escolha o site **US1** (`datadoghq.com`) — é o default do código.
   Se escolher outro, ajuste depois `DATADOG_SITE` e `DATADOG_API_URL`.
3. Pule os passos de instalação de Agent que a UI sugere (o Terraform faz).

## 2. API key (ingestão)

*Organization Settings → API Keys → New Key* → nome `oficina-ingest`.
Copie o valor.

## 3. Application key (Terraform)

*Organization Settings → Application Keys → New Key* → nome `oficina-terraform`.

**Escopos** (Scopes) — marque no mínimo:
`dashboards_write`, `monitors_write`, `synthetics_write`, `metrics_write`
(inclui `metric_tags_write`). Se a UI da trial não permitir limitar escopo,
uma key sem escopo também serve.
Copie o valor.

## 4. Guardar as chaves no AWS Secrets Manager

Com as credenciais do lab ativas (`export AWS_PROFILE=academy`):

```bash
DD_API_KEY="<api key do passo 2>"
DD_APP_KEY="<app key do passo 3>"

aws secretsmanager restore-secret --secret-id oficina/datadog 2>/dev/null || true
aws secretsmanager create-secret --name oficina/datadog \
  --secret-string "{\"api_key\":\"$DD_API_KEY\",\"app_key\":\"$DD_APP_KEY\"}" \
  2>/dev/null \
|| aws secretsmanager put-secret-value --secret-id oficina/datadog \
  --secret-string "{\"api_key\":\"$DD_API_KEY\",\"app_key\":\"$DD_APP_KEY\"}"
```

As chaves **nunca** vão para o Git, GitHub Secrets, tfvars ou Terraform state —
os pipelines leem do Secrets Manager em runtime e mascaram com `::add-mask::`.

## 5. Ligar nos pipelines

```bash
gh variable set DATADOG_ENABLED   -R christochula/oficina-infra-kubernetes -b "true"
gh variable set DATADOG_SECRET_ID -R christochula/oficina-infra-kubernetes -b "oficina/datadog"
gh variable set DD_ENABLED        -R christochula/oficina-api              -b "true"
# opcional, se não for US1:
# gh variable set DATADOG_SITE     -R christochula/oficina-infra-kubernetes -b "datadoghq.eu"
# gh variable set DATADOG_API_URL  -R christochula/oficina-infra-kubernetes -b "https://api.datadoghq.eu/"
```

Com `DATADOG_ENABLED=true`, o deploy do `oficina-infra-kubernetes`:

- instala o **Datadog Agent** (Helm, DaemonSet + Cluster Agent) no EKS —
  logs, APM, DogStatsD, kube-state-metrics;
- aplica o stack **`observability/`** — 1 dashboard (10 widgets), 5 monitores
  de métrica + 1 Synthetic HTTP em `/api/health/ready`, e a config de tags das
  métricas (percentis p95/p99).

Com `DD_ENABLED=true`, o deploy do `oficina-api` injeta `DD_TRACE_ENABLED` /
`DD_METRICS_ENABLED` / `DD_RUNTIME_METRICS_ENABLED` = `true` nos pods.

## 6. Depois do deploy: apontar o Synthetic para a URL real

```bash
gh variable set API_BASE_URL -R christochula/oficina-infra-kubernetes -b "http://<elb-do-eks>"
gh workflow run "Terraform deploy" -R christochula/oficina-infra-kubernetes --ref main
```

## 7. O que NÃO estamos usando (limitação do AWS Academy — registrar em ADR)

- **Integração AWS↔Datadog** (métricas CloudWatch de API Gateway / Lambda / RDS):
  exige criar uma IAM role cross-account, bloqueado no Learner Lab. A app e o
  cluster continuam totalmente cobertos pelo Agent; API Gateway e Lambda têm
  logs no CloudWatch e (se `datadog_enabled` nas Lambdas) APM próprio.
- **Datadog Synthetic Private Location**: não é mais necessária — o ELB do EKS
  é público, então uma location pública (`aws:us-east-1`) alcança
  `/api/health/ready`.

## 8. Validação (ver `datadog.md` seção "Validação pós-deploy")

Resumo:

```bash
kubectl get pods -n datadog
kubectl exec -n datadog daemonset/datadog -- agent status | grep -A3 'APM\|Logs\|DogStatsD'
# Log Explorer:  service:oficina-api env:homolog @correlation_id:<id>
# Metrics Explorer:  oficina.api.request.duration_ms, oficina.service_orders.created, ...
```
