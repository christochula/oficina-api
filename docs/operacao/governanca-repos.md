# Governança dos repositórios — comandos prontos

Comandos para: (1) proteção da branch `main`, (2) adicionar `soat-architecture`,
(3) renovar as credenciais do AWS Academy nos 4 repos.

**Requer `gh` autenticado com acesso admin efetivo aos repos** (o usuário
`kaalage` tem). Nada aqui foi executado ainda — decisão de branch protection
está pendente de alinhamento com o Matheus.

---

## 1. Proteção da branch `main`

Aplica: sem push direto, PR obrigatório, checks obrigatórios, sem force-push,
sem deleção, histórico linear, regras valem para admins.

> `required_approving_review_count`:
> - **1** = alguém do time precisa aprovar o PR (alinhado com o enunciado).
> - **0** = PR obrigatório mas sem aprovação (use se for trabalhar sozinha).

```bash
protect () {
  local repo="$1"; shift
  local contexts_json
  contexts_json="$(printf '%s\n' "$@" | jq -R . | jq -sc .)"
  gh api -X PUT "repos/christochula/${repo}/branches/main/protection" --input - <<JSON
{
  "required_status_checks": { "strict": true, "contexts": ${contexts_json} },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
}

protect oficina-api                 "Quality" "E2E" "Container"
protect oficina-infra-kubernetes    "Validate aws" "Validate observability"
protect oficina-infra-database      "Validate" "Plan"
protect oficina-auth-serverless     "application" "terraform"
```

Conferir:

```bash
for r in oficina-api oficina-infra-kubernetes oficina-infra-database oficina-auth-serverless; do
  echo "== $r =="
  gh api "repos/christochula/$r/branches/main/protection" \
    --jq '{pr:.required_pull_request_reviews.required_approving_review_count, checks:.required_status_checks.contexts, admins:.enforce_admins.enabled}'
done
```

Reverter (se precisar durante o desenvolvimento):

```bash
gh api -X DELETE "repos/christochula/<repo>/branches/main/protection"
```

---

## 2. Adicionar `soat-architecture` (requisito de entrega)

```bash
for r in oficina-api oficina-infra-kubernetes oficina-infra-database oficina-auth-serverless; do
  gh api -X PUT "repos/christochula/$r/collaborators/soat-architecture" -f permission=pull
done
```

`permission=pull` (leitura) é suficiente para o requisito. Confirmar:

```bash
for r in oficina-api oficina-infra-kubernetes oficina-infra-database oficina-auth-serverless; do
  gh api "repos/christochula/$r/collaborators/soat-architecture/permission" --jq "\"$r -> \" + .permission" 2>&1
done
```

O convite fica **pendente** até `soat-architecture` aceitar. Só afirme no PDF
que o acesso existe depois de confirmar `.permission` diferente de `pending`.

---

## 3. Renovar credenciais do AWS Academy (a cada sessão, ~4 h)

No AWS Academy: **AWS Details → AWS CLI: Show**. Depois:

```bash
ACCESS="ASIA..."; SECRET="..."; TOKEN="..."

# perfil local
aws configure set aws_access_key_id     "$ACCESS" --profile academy
aws configure set aws_secret_access_key "$SECRET" --profile academy
aws configure set aws_session_token     "$TOKEN"  --profile academy

# secrets dos 4 repos
for r in oficina-api oficina-infra-kubernetes oficina-infra-database oficina-auth-serverless; do
  printf '%s' "$ACCESS" | gh secret set AWS_ACCESS_KEY_ID     -R "christochula/$r"
  printf '%s' "$SECRET" | gh secret set AWS_SECRET_ACCESS_KEY -R "christochula/$r"
  printf '%s' "$TOKEN"  | gh secret set AWS_SESSION_TOKEN      -R "christochula/$r"
done
```

---

## Estado atual (verificado)

| Repo | branch protection | `soat-architecture` |
|---|---|---|
| oficina-api | ❌ não configurada | ❌ |
| oficina-infra-kubernetes | ❌ | ❌ |
| oficina-infra-database | ❌ | ❌ |
| oficina-auth-serverless | ❌ | ❌ |

Os arquivos `.github/settings.yml` de cada repo descrevem a intenção mas **não
são aplicados** (não há GitHub Settings App instalado).
