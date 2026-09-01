# RFC-004 — Observabilidade unificada no Datadog

- Status: aceita
- Data: 2026-08-31
- Responsáveis: equipe SOAT

## Contexto

É obrigatório monitorar latência da API, CPU/memória do Kubernetes, saúde, disponibilidade, falhas no processamento de ordens, logs JSON e correlação de requisições. Também são exigidos painéis de volume diário, tempo médio por etapa e erros de integração.

## Proposta

Usar Datadog como plano de observabilidade:

- Datadog Operator instala Agent e Cluster Agent no EKS.
- Admission Controller injeta o tracer e as tags unificadas `env`, `service` e `version` nos pods.
- `dd-trace` é carregado antes do NestJS para APM; logs JSON recebem `dd.trace_id`, `dd.span_id` e `correlation_id`.
- DogStatsD recebe métricas de latência, criação/transição/tempo de etapa, falha de OS e integração.
- Lambda Extension e library instrumentam autenticação, authorizer e notificações.
- Integração AWS encaminha métricas de API Gateway, Lambda, ALB e RDS.
- Dashboards, monitores e teste sintético são gerenciados por Terraform no repositório de Kubernetes.

## Convenções

| Dimensão | Exemplo |
|---|---|
| `env` | `homolog`, `production` |
| `service` | `oficina-api`, `oficina-auth` |
| `version` | SHA imutável da imagem/função |
| `correlation_id` | UUID recebido ou criado na borda da aplicação |

Não são permitidas tags com CPF, token, e-mail, descrição livre ou outro valor de alta cardinalidade/sensível.

## Alternativas consideradas

- New Relic: aceito pelo enunciado, mas não escolhido pelo solicitante.
- Apenas CloudWatch: não consolida, com a mesma experiência, cluster, APM, logs, sintéticos e métricas de negócio exigidas.
- Prometheus/Grafana/Loki autogerenciados: viáveis, porém adicionariam componentes operacionais e não atenderiam a escolha explícita por Datadog.

## Consequências

- API key e app key precisam existir fora do Git e ter escopo mínimo.
- Custom metrics e ingestão de logs exigem controle de cardinalidade, amostragem e retenção para custo previsível.
- Alertas precisam de responsáveis e canais externos; os recursos locais criam monitores, mas a conexão com Slack/e-mail/PagerDuty depende da conta Datadog.
- Falhas de telemetria não podem interromper a API.

## Critérios de aceite

- Uma chamada pode ser localizada pelo mesmo `correlation_id` nos logs e pelo trace associado.
- Dashboard exibe os três indicadores obrigatórios e saúde da plataforma.
- Monitores têm limiar, janela, mensagem, tags e recuperação verificáveis.
- Logs e métricas não revelam CPF ou JWT.

