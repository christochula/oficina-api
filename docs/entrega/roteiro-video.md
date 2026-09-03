# Roteiro do vídeo final — duração-alvo 14min30s

Limite do desafio: 15 minutos. Grave em 1080p, fonte grande, abas/terminais
preparados. **Nunca** mostre CPF real, JWT completo, segredo, Terraform state,
variáveis protegidas ou dados pessoais. A documentação **não** precisa aparecer.

## Antes de gravar

- Execute o deploy completo pelo [runbook do Academy](../operacao/runbook-deploy-academy.md)
  e a verificação da seção 7.
- Rode o seed de demonstração (clientes com CPF: `732.145.980-23`, `418.729.650-67`, `963.852.740-47`).
- Datadog fixado em `Past 15 Minutes`, `env:homolog`. Gere tráfego (repita a
  seção 7 do runbook algumas vezes + avance uma OS) para as métricas aparecerem.
- Abas prontas: 4 repositórios · GitHub Actions · Swagger (`$API_ENDPOINT/api/docs`) ·
  Datadog (dashboard, monitor, Log Explorer, um trace).
- Cronômetro visível.

## Linha do tempo

### 00:00–00:35 — Abertura

“Esta é a Fase 3 da Oficina: aplicação, autenticação serverless, Kubernetes e
banco em **quatro repositórios** com CI/CD, rodando em **AWS Academy** com
Terraform e observabilidade Datadog.” Mostrar os 4 links e o commit demonstrado.

### 00:35–02:20 — Arquitetura

Abrir `docs/arquitetura/diagrama-cloud.md` (ou a versão em ícones AWS). Caminho:

1. Cliente → **API Gateway HTTP API**;
2. **Lambda** valida CPF + cliente ativo (consulta o RDS via TLS) → **JWT curto**;
3. **Lambda authorizer** protege `ANY /api/{proxy+}`;
4. API Gateway faz **HTTP_PROXY** para o **ELB público** do `Service LoadBalancer`;
5. Pods NestJS no **EKS** → **RDS PostgreSQL** (TLS forçado);
6. Notificações **SQS → Lambda → SNS**;
7. **Datadog Agent** (DaemonSet) coleta logs/APM/DogStatsD/kube-state.

Mencionar: 4 repos com responsabilidades separadas; adaptações do Academy
documentadas em ADR-005..009 (LabRole, ingress público, RDS público com TLS).

### 02:20–03:50 — CI/CD

- Um **Pull Request** de cada repo com **checks verdes** (`validate`/`plan` ou
  `build`/`test`).
- `main` protegida, PR obrigatório, force-push bloqueado (mostrar Settings → Rules).
- Autenticação AWS por **credenciais de sessão** do lab (secrets do repo).
- Mostrar um **run de deploy concluído** (Actions) de pelo menos um repo de infra
  e do `oficina-api` (build → ECR → `helm upgrade`).

Não abrir logs que revelem variáveis.

### 03:50–05:30 — Autenticação por CPF

Swagger ou `curl`: `POST $API_ENDPOINT/auth/token` com `{"cpf":"732.145.980-23"}`
→ **200**, mostrar só `token_type`/`expires_in` (não o token inteiro).
Depois `{"cpf":"111.111.111-11"}` → **401 genérico**.

Explicar: checksum + normalização, consulta parametrizada ao RDS via TLS,
só cliente ativo, CPF fora do token e dos logs, TTL de 5 min.

### 05:30–06:50 — API protegida

`GET $API_ENDPOINT/api/v1/ordens-servico/minhas/lista`:

1. sem `Authorization` → **401**;
2. com `Bearer <jwt>` → **200**, só recursos do próprio cliente;
3. mostrar `X-Correlation-Id` no request e na resposta.

### 06:50–09:00 — Fluxo da ordem de serviço

Com requests preparados (Postman): abrir OS → Diagnóstico → aprovação →
Execução → Finalização. Mostrar o histórico; explicar que a criação persiste o
histórico na mesma transação.

### 09:00–10:30 — Deploy e Kubernetes

```bash
kubectl get deploy,hpa,pdb,pods,svc -n oficina -o wide
kubectl rollout status deployment/oficina-api -n oficina
curl -s $API_ENDPOINT/api/health/ready   # {"status":"ok","database":"up"}
```

Apontar: 2 pods mínimos, **HPA 2–8**, probes HTTP, PDB, `Service LoadBalancer`,
job de migration `Completed`, tag da imagem = SHA.

### 10:30–12:50 — Dashboard Datadog ao vivo

Atualizar o dashboard `Oficina | Operação e Observabilidade | homolog`:

- volume diário de OS;
- tempo médio + p95 em Diagnóstico / Execução / Finalização;
- latência p50/p95/p99 da API;
- CPU e memória por pod;
- erros de integração e falhas de processamento de OS.

Abrir um **monitor**; se houver evidência segura, mostrar um ciclo
`OK → ALERT → OK` provocado em homolog (ex.: p95 de latência ou falha de OS).

### 12:50–14:10 — Logs e traces correlacionados

Log Explorer: `service:oficina-api env:homolog @correlation_id:<id da chamada>`.
Abrir o evento JSON (`service/env/version`, `dd.trace_id`) e o **trace**
conectado com spans (API + Prisma/PostgreSQL). Destacar: sem CPF, sem JWT.

### 14:10–14:30 — Encerramento

“Links dos 4 repositórios, documentação e evidências no PDF de entrega. O usuário
`soat-architecture` foi adicionado aos 4 repositórios.” (só afirme depois de
confirmar o acesso).

## Plano de corte se ultrapassar o tempo

Encurtar o fluxo de OS (06:50–09:00) e as explicações. **Não cortar:**
autenticação CPF, API protegida, CI/CD + deploy, dashboard ao vivo, logs+traces,
os 4 repositórios.
