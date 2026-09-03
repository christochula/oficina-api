# Estado atual — Tech Challenge Fase 3 (checkpoint)

Atualizado em 2026-09-03. Registra tudo que foi feito na preparação e o que
falta. Ambiente: **AWS Academy Learner Lab** (conta `519768589921`, `us-east-1`).

---

## 1. Decisão de arquitetura

Manter os **4 repositórios separados**, cada um com CI/CD próprio, deployados
nesta ordem de dependência:

```
oficina-infra-kubernetes → oficina-infra-database → oficina-auth-serverless → oficina-api
```

Cada repositório foi adaptado ao **padrão AWS Academy** (referência:
`dougls/terraform-academy`, `dougls/terraform-soat`):

- **`LabRole`** em tudo que precisa de IAM role (cluster EKS, node group, Lambdas).
- **Credenciais de sessão** do lab como GitHub Secrets — sem OIDC.
- **Sem IRSA** — pods usam a `LabRole` do node.
- **Ingress** via `Service type: LoadBalancer` (ELB público) — sem ALB interno / VPC Link.
- **API Gateway** → `HTTP_PROXY` (internet) para a URL do ELB.
- **RDS** público com `rds.force_ssl` — sem RDS Proxy (Lambda de auth roda fora de VPC).
- **Sem** Cluster Autoscaler, External Secrets Operator, Datadog Operator, integração AWS↔Datadog.

Justificativa completa e caminho de reversão para conta real: `docs/adr/ADR-005` a `ADR-009`.

---

## 2. Pull Requests (todos com CI verde, **nenhum mergeado**)

| Repositório | PR | O que faz no merge | Plan |
|---|---|---|---|
| `oficina-infra-kubernetes` | [#5](https://github.com/christochula/oficina-infra-kubernetes/pull/5) | VPC(default) + EKS 1.32 + node group + ECR + metrics-server + (Datadog Agent) + observability | 10 recursos |
| `oficina-infra-database` | [#1](https://github.com/christochula/oficina-infra-database/pull/1) | RDS PostgreSQL 16 `db.t3.micro` + SG + secret de conexão | 7 recursos |
| `oficina-auth-serverless` | [#1](https://github.com/christochula/oficina-auth-serverless/pull/1) | API Gateway HTTP API + 3 Lambdas (CPF→JWT, authorizer, notification) + SQS/SNS | 30 recursos |
| `oficina-api` | [#11](https://github.com/christochula/oficina-api/pull/11) | imagem → ECR + `helm upgrade` no EKS + migrations | — |

Branch de trabalho em todos: `feature/tech-challenge-phase-3`.

GitHub Secrets `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN`
já criados nos 4 repos (**expiram ~4 h** — renovar antes de cada sessão, ver
`docs/operacao/governanca-repos.md` §3).

---

## 3. Infraestrutura já criada na AWS

Apenas o bucket de state: **`oficina-tc3-tfstate-519768589921`** (vazio,
versionado). Nada mais — sem EKS, RDS, Lambda, etc.

State keys: `oficina/{kubernetes,database,auth,observability}/terraform.tfstate`.

---

## 4. Observabilidade (Datadog)

**Pronto no código:** Datadog Agent (Helm, gated), app instrumentada (dd-trace,
5 métricas DogStatsD, logs JSON, `correlation_id` ↔ `dd.trace_id`), `observability/`
(1 dashboard 10 widgets, 5 monitores, 1 Synthetic HTTP público, config de tags
para percentis).

**Falta (manual, ~5 min):** criar conta Datadog (free trial 14 dias) + API key +
APP key + secret `oficina/datadog` + `gh variable set`. Passo a passo:
`docs/operacao/datadog-setup.md`.

---

## 5. Documentação (`docs/`)

- `docs/README.md` — índice.
- `arquitetura/`: visão geral + diagrama de componentes, diagrama cloud macro
  (mermaid + guia de ícones AWS), sequências de autenticação e de abertura de OS,
  modelo de dados / ER.
- `rfc/`: RFC-001 a 004 (AWS, PostgreSQL, CPF, Datadog).
- `adr/`: ADR-001 a 009 (as 005–009 documentam as adaptações do Academy).
- `operacao/`: **runbook-deploy-academy.md**, **datadog-setup.md**,
  **governanca-repos.md**, datadog.md, destroy.md.
- `entrega/`: roteiro do vídeo (≤15 min), base do PDF, checklist, matriz.

---

## 6. O que falta (não bloqueia o deploy)

| # | Ação | Responsável | Referência |
|---|---|---|---|
| 1 | Alinhar branch protection com o Matheus e aplicar nos 4 repos | Karina + Matheus | `docs/operacao/governanca-repos.md` §1 |
| 2 | Adicionar `soat-architecture` como colaborador nos 4 repos | Karina/colega | `governanca-repos.md` §2 |
| 3 | Criar conta Datadog + 2 chaves + secret | Karina | `docs/operacao/datadog-setup.md` |
| 4 | Sessão AWS + Matheus: renovar credenciais → merge dos 4 PRs → deploy → seed | time | `docs/operacao/runbook-deploy-academy.md` |
| 5 | Recriar o diagrama cloud com ícones AWS oficiais (draw.io) | Karina | base em `docs/arquitetura/diagrama-cloud.md` |
| 6 | Gravar o vídeo (≤15 min) e montar o PDF | time | `docs/entrega/` |

**Prazo de entrega: dia 15.**

---

## 7. Sequência da sessão de deploy (resumo)

```
0. renovar credenciais (perfil academy + 4 repos) + criar secret oficina/homolog/jwt
1. merge PR kubernetes        → EKS + ECR (~15 min)
2. merge PR database          → RDS (~10 min) → anotar DB_SECRET_ARN
3. gh variable set DB_SECRET_ARN, JWT_SECRET_ARN → merge PR auth (~5 min)
   → anotar api_endpoint e notification_queue_url
4. gh variable set NOTIFICATION_QUEUE_URL → merge PR app (~10 min)
   → anotar URL do ELB
5. gh variable set BACKEND_URL → gh workflow run Deploy (auth)  [liga API Gateway ao app]
6. rodar seed + seed-demo (pod efêmero)
7. verificação ponta a ponta (runbook §7)
8. (opcional) Datadog: criar conta + secret + DATADOG_ENABLED/DD_ENABLED/API_BASE_URL
```

Detalhe completo em `docs/operacao/runbook-deploy-academy.md`.
