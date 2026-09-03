# Datadog: sinais, dashboards, monitores e validação

## Topologia implementada

- `oficina-infra-kubernetes` instala Datadog Operator, `DatadogAgent`, integração AWS, dashboard, monitores e Synthetic API test.
- O Cluster Agent coleta estado do Kubernetes; Agents nos nós recebem infraestrutura, logs, APM e DogStatsD.
- A aplicação inicializa `dd-trace` antes dos módulos NestJS, usa unified service tagging e escreve JSON em stdout.
- Lambdas usam a library Node.js e a Datadog Lambda Extension; API Gateway/Lambda/RDS também chegam pela integração AWS.
- Chaves Datadog vêm de segredo externo. Nenhuma chave está no repositório, imagem ou manifest renderizado.

No GitHub Environment autoritativo, defina `ENABLE_AWS_INTEGRATION=true` em um único state por conta AWS e `MANAGE_DATADOG_METRIC_TAGS=true` em um único state por organização Datadog. Homologação permanece `false` quando compartilha a mesma conta/organização com produção, evitando conflito sobre recursos globais.

Referências operacionais oficiais: [instalação no Kubernetes](https://docs.datadoghq.com/containers/kubernetes/installation/?tab=datadogoperator), [tracing Node.js](https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/nodejs/) e [correlação entre logs e traces](https://docs.datadoghq.com/tracing/other_telemetry/connect_logs_and_traces/).

## Tags e dados sensíveis

Tags obrigatórias: `env`, `service` e `version`. Tags de domínio são enumeradas, por exemplo `status:diagnostico`. Não enviar CPF, JWT, e-mail, placa, texto do diagnóstico, ID de correlação ou ID de OS como tag de métrica.

O `correlation_id` é um atributo de log e cabeçalho de resposta. `dd.trace_id` e `dd.span_id` são injetados quando a chamada está em um trace. O logger não registra `Authorization`, corpo da autenticação nem connection string.

## Métricas da aplicação

| Métrica | Tipo | Uso |
|---|---|---|
| `oficina.api.request.duration_ms` | distribution | p50/p95/p99 de latência por ambiente/serviço |
| `oficina.service_orders.created` | count | volume diário de OS abertas |
| `oficina.service_orders.status_transition` | count | transições por status |
| `oficina.service_orders.status_duration_ms` | distribution | tempo em `diagnostico`, `execucao` e `finalizacao` |
| `oficina.service_orders.processing_errors` | count | falhas ao processar/persistir OS |
| `oficina.integrations.errors` | count | erros em webhook/integrações |

O dashboard como código deve conter, no mínimo:

1. volume diário com `sum:oficina.service_orders.created{env:$env}.as_count()`;
2. tempo médio/p95 por `status` de `oficina.service_orders.status_duration_ms`;
3. erros de integração com `sum:oficina.integrations.errors{env:$env}.as_count()`;
4. p95 de latência da API;
5. CPU e memória dos containers/pods;
6. disponibilidade do endpoint `/api/health/ready`;
7. falhas de processamento de OS e taxa de erro HTTP/Lambda.

## Limiar inicial dos monitores

O enunciado não define SLO nem limiares. Estes valores são hipóteses iniciais e devem ser calibrados em homologação:

| Monitor | Condição inicial | Ação esperada |
|---|---|---|
| Saúde sintética | 3 falhas consecutivas | verificar Gateway, ALB, pods, migration e banco |
| Latência da API | p95 > 1 s na janela de 5 min | analisar trace, saturação e queries |
| Falha de OS | soma > 0 em 10 min | localizar evento/correlation ID e avaliar integridade |
| Erro de integração | soma > 0 em 10 min | verificar dependência, retry e DLQ |
| CPU Kubernetes | > 0,9 core por pod durante 10 min | conferir HPA, requests e nós |
| Memória Kubernetes | > 90% do limite por 10 min | investigar heap/OOM e calibrar limite |
| Erros Lambda | > 0 sustentado por 5 min | conferir CloudWatch/APM, Proxy e segredos |

Mensagens incluem `env`, `service`, link para o runbook e blocos de recuperação. O canal `SUBSTITUIR_CANAL_ALERTA` precisa ser conectado na conta Datadog.

## Validação pós-deploy

### 1. Agentes e tags

```bash
kubectl get datadogagent -A
kubectl get pods -n datadog
kubectl get pods -n oficina --show-labels
kubectl exec -n datadog daemonset/datadog-agent -- agent status
```

Confirmar APM, logs e DogStatsD saudáveis e `env/service/version` visíveis.

### 2. Saúde e latência

```bash
curl -i "SUBSTITUIR_API_URL/api/health/live"
curl -i "SUBSTITUIR_API_URL/api/health/ready"
```

O primeiro prova vida do processo; o segundo só retorna sucesso após consultar o banco.

### 3. Correlação ponta a ponta

```bash
curl -i -H "X-Correlation-Id: 02d71b58-80bf-4df6-8a7c-f80a28e781ce" \
  -H "Authorization: Bearer SUBSTITUIR_TOKEN" \
  "SUBSTITUIR_API_URL/api/v1/ordens-servico/minhas/lista"
```

No Log Explorer, buscar:

```text
service:oficina-api env:homolog @correlation_id:02d71b58-80bf-4df6-8a7c-f80a28e781ce
```

Abrir o trace relacionado e confirmar spans de API, Prisma/PostgreSQL e status HTTP. O cabeçalho deve reaparecer na resposta.

### 4. Métricas de negócio

Criar uma OS de teste, percorrer Diagnóstico, Execução e Finalização e confirmar os pontos no Metrics Explorer. A duração de cada etapa só existe após a transição correspondente.

### 5. Falhas controladas

- Em homologação, usar credencial inválida para provocar erro de integração sem revelar segredo.
- Testar health em uma janela controlada de indisponibilidade, depois restaurar.
- Confirmar que monitor entra em alerta e recupera; registrar timestamps e links.
- Não interromper produção apenas para gerar evidência.

## Diagnóstico rápido

| Sintoma | Verificações |
|---|---|
| Traces ausentes | tracer carregado antes do Nest, Agent acessível, porta 8126, admission labels |
| Logs sem trace ID | JSON, `DD_LOGS_INJECTION=true`, span ativo, configuração de coleta |
| Métricas ausentes | `DD_AGENT_HOST`, UDP 8125, non-local traffic, nome/tag da métrica |
| Pods não vistos | Operator/Cluster Agent, RBAC, tolerations e estado do nó |
| Lambda ausente | layers/Extension, API key secret, site/região, versão runtime |
| Painel vazio | ambiente selecionado, janela temporal, geração real do evento e cardinalidade |

