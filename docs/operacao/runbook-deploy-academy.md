# Runbook — Deploy dos 4 repositórios no AWS Academy

Sequência para subir a solução completa numa sessão do AWS Academy Learner Lab
(≈ 3–4 h de validade das credenciais). Ordem obrigatória:

```
oficina-infra-kubernetes  →  oficina-infra-database  →  oficina-auth-serverless  →  oficina-api
```

Cada passo = **merge do PR** → o `deploy.yml` do repositório roda `terraform apply`
(ou `helm upgrade`) automaticamente. Nada de branch protection é obrigatório ainda
(pendência com o Matheus); o merge dispara o deploy.

Tempo total estimado: **~40 min** (EKS ~15, RDS ~10, serverless ~5, app ~10).

---

## 0. Pré-voo (uma vez por sessão)

### 0.1 Credenciais do lab

No AWS Academy: **Start Lab** → **AWS Details** → **AWS CLI: Show**. Copie os 3 valores.

Perfil local:

```bash
aws configure set aws_access_key_id     "<ASIA...>"      --profile academy
aws configure set aws_secret_access_key "<...>"          --profile academy
aws configure set aws_session_token     "<...>"          --profile academy
aws configure set region us-east-1                       --profile academy
export AWS_PROFILE=academy
aws sts get-caller-identity   # confirma conta 519768589921
```

Secrets nos 4 repositórios (renovar **todos** a cada sessão):

```bash
ACCESS="<ASIA...>"; SECRET="<...>"; TOKEN="<...>"
for R in oficina-infra-kubernetes oficina-infra-database oficina-auth-serverless oficina-api; do
  printf '%s' "$ACCESS" | gh secret set AWS_ACCESS_KEY_ID     -R christochula/$R
  printf '%s' "$SECRET" | gh secret set AWS_SECRET_ACCESS_KEY -R christochula/$R
  printf '%s' "$TOKEN"  | gh secret set AWS_SESSION_TOKEN      -R christochula/$R
done
```

### 0.2 Secret JWT compartilhado (Lambda de auth ↔ aplicação)

```bash
JWT_SECRET="$(openssl rand -hex 32)"
JWT_REFRESH="$(openssl rand -hex 32)"
aws secretsmanager restore-secret --secret-id oficina/homolog/jwt 2>/dev/null || true
aws secretsmanager create-secret --name oficina/homolog/jwt \
  --secret-string "{\"secret\":\"$JWT_SECRET\",\"refreshSecret\":\"$JWT_REFRESH\"}" \
  2>/dev/null \
|| aws secretsmanager put-secret-value --secret-id oficina/homolog/jwt \
  --secret-string "{\"secret\":\"$JWT_SECRET\",\"refreshSecret\":\"$JWT_REFRESH\"}"

JWT_SECRET_ARN="$(aws secretsmanager describe-secret --secret-id oficina/homolog/jwt --query ARN --output text)"
echo "JWT_SECRET_ARN=$JWT_SECRET_ARN"
```

---

## 1. oficina-infra-kubernetes (EKS + ECR)

```bash
gh pr merge <PR> -R christochula/oficina-infra-kubernetes --squash
gh run watch -R christochula/oficina-infra-kubernetes   # ~15 min
```

Ao fim, confirme os outputs no *summary* do run, ou:

```bash
aws eks update-kubeconfig --name oficina-homolog-eks --region us-east-1
kubectl get nodes                      # 2 nós Ready
aws ecr describe-repositories --repository-names oficina-homolog-api --query 'repositories[0].repositoryUri'
```

---

## 2. oficina-infra-database (RDS)

```bash
gh pr merge <PR> -R christochula/oficina-infra-database --squash
gh run watch -R christochula/oficina-infra-database     # ~10 min
```

Pegue o ARN do secret de conexão (é o `DB_SECRET_ARN` do próximo passo):

```bash
DB_SECRET_ARN="$(aws secretsmanager describe-secret --secret-id oficina/homolog/database/connection --query ARN --output text)"
echo "DB_SECRET_ARN=$DB_SECRET_ARN"
```

---

## 3. oficina-auth-serverless (Lambda CPF + API Gateway + SQS)

**Antes do merge**, configure as Variables do repositório:

```bash
gh variable set DB_SECRET_ARN  -R christochula/oficina-auth-serverless -b "$DB_SECRET_ARN"
gh variable set JWT_SECRET_ARN -R christochula/oficina-auth-serverless -b "$JWT_SECRET_ARN"
# BACKEND_URL fica com o placeholder por enquanto (o app ainda não subiu).
```

```bash
gh pr merge <PR> -R christochula/oficina-auth-serverless --squash
gh run watch -R christochula/oficina-auth-serverless    # ~5 min
```

Pegue os outputs (no *summary* do run ou `terraform output`):

```bash
# Da aba Actions -> run -> "Publish outputs":
#   api_endpoint            = https://xxxx.execute-api.us-east-1.amazonaws.com
#   auth_token_endpoint     = .../auth/token
#   notification_queue_url  = https://sqs.us-east-1.amazonaws.com/519768589921/oficina-auth-homolog-notifications-queue
API_ENDPOINT="<api_endpoint>"
NOTIFICATION_QUEUE_URL="<notification_queue_url>"
```

---

## 4. oficina-api (imagem → ECR + Helm no EKS)

**Antes do merge**, configure as Variables:

```bash
gh variable set NOTIFICATION_QUEUE_URL -R christochula/oficina-api -b "$NOTIFICATION_QUEUE_URL"
gh variable set DD_ENABLED             -R christochula/oficina-api -b "false"
# DATABASE_SECRET_ID e JWT_SECRET_ID já têm default correto
# (oficina/homolog/database/connection e oficina/homolog/jwt).
```

```bash
gh pr merge <PR> -R christochula/oficina-api --squash
gh run watch -R christochula/oficina-api                # ~10 min
```

O *summary* do run mostra a URL do LoadBalancer. Ou:

```bash
kubectl get svc oficina-api -n oficina \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
LB_HOST="<hostname-acima>"
# aguarde ~2-3 min o ELB ficar healthy
curl -sS "http://$LB_HOST/api/health/ready"     # {"status":"ok","database":"up"}
```

---

## 5. Ligar o API Gateway na aplicação

O API Gateway (passo 3) subiu com um `backend_url` placeholder. Agora aponte-o
para o ELB real e re-aplique:

```bash
gh variable set BACKEND_URL -R christochula/oficina-auth-serverless -b "http://$LB_HOST"
gh workflow run Deploy -R christochula/oficina-auth-serverless --ref main
gh run watch -R christochula/oficina-auth-serverless
```

---

## 6. Dados de demonstração (clientes com CPF)

O seed cria o admin e a massa de demonstração. Rode um pod efêmero com a imagem
já publicada:

```bash
IMG="$(aws ecr describe-repositories --repository-names oficina-homolog-api --query 'repositories[0].repositoryUri' --output text):latest"

kubectl run seed-demo -n oficina --rm -i --restart=Never --image="$IMG" \
  --overrides='{"spec":{"containers":[{"name":"seed","image":"'"$IMG"'","command":["npx","ts-node","prisma/seed.ts"],"envFrom":[{"secretRef":{"name":"oficina-api"}}]}]}}'

kubectl run seed-demo -n oficina --rm -i --restart=Never --image="$IMG" \
  --overrides='{"spec":{"containers":[{"name":"seed","image":"'"$IMG"'","command":["npx","ts-node","prisma/seed-demo.ts"],"envFrom":[{"secretRef":{"name":"oficina-api"}}]}]}}'
```

**Clientes de demonstração (CPF já validado):**

| CPF | Nome |
|---|---|
| `732.145.980-23` | Ana Beatriz Souza |
| `418.729.650-67` | Bruno Henrique Lima |
| `963.852.740-47` | Camila Rodrigues Alves |

Admin (login de operador): `admin@oficina.com` / valor de `ADMIN_SEED_PASSWORD`
(default `Admin@123` — defina um secret se quiser outro).

---

## 7. Verificação ponta a ponta

```bash
# 1. Autenticação por CPF -> JWT
TOKEN="$(curl -sS -X POST "$API_ENDPOINT/auth/token" \
  -H 'content-type: application/json' \
  -H 'x-correlation-id: demo-runbook-001' \
  -d '{"cpf":"732.145.980-23"}' | jq -r .access_token)"
echo "${TOKEN:0:20}..."   # não mostre o token inteiro no vídeo

# 2. CPF inválido -> 401 genérico
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$API_ENDPOINT/auth/token" \
  -H 'content-type: application/json' -d '{"cpf":"111.111.111-11"}'   # 401

# 3. Rota protegida sem token -> 401
curl -sS -o /dev/null -w '%{http_code}\n' "$API_ENDPOINT/api/v1/ordens-servico/minhas/lista"

# 4. Rota protegida com token -> 200
curl -sS -H "authorization: Bearer $TOKEN" -H 'x-correlation-id: demo-runbook-002' \
  "$API_ENDPOINT/api/v1/ordens-servico/minhas/lista"

# 5. Health e Swagger pelo API Gateway
curl -sS "$API_ENDPOINT/api/health/ready"
echo "$API_ENDPOINT/api/docs"

# 6. Kubernetes
kubectl get deploy,hpa,pdb,pods -n oficina -o wide
kubectl rollout status deployment/oficina-api -n oficina
```

Checklist:

- [ ] `kubectl get nodes` → 2 Ready
- [ ] `POST /auth/token` com CPF válido → 200 + `access_token`
- [ ] CPF inválido / inexistente → 401 genérico
- [ ] rota protegida sem Bearer → 401; com Bearer → 200
- [ ] `X-Correlation-Id` aparece na resposta
- [ ] `/api/health/ready` → `database: up`
- [ ] HPA `oficina-api` com `2/2..8`
- [ ] job `oficina-api-migrate-*` `Completed`
- [ ] Swagger acessível em `$API_ENDPOINT/api/docs`

---

## 8. Observabilidade (Datadog)

Passo a passo completo em **`documentacao/operacao/datadog-setup.md`**. Resumo:

1. Criar conta Datadog (free trial) + API key + APP key.
2. `aws secretsmanager create-secret --name oficina/datadog --secret-string '{"api_key":"...","app_key":"..."}'`
3. Ligar:
   ```bash
   gh variable set DATADOG_ENABLED -R christochula/oficina-infra-kubernetes -b "true"
   gh variable set DD_ENABLED      -R christochula/oficina-api              -b "true"
   gh variable set API_BASE_URL    -R christochula/oficina-infra-kubernetes -b "http://$LB_HOST"
   gh workflow run "Terraform deploy" -R christochula/oficina-infra-kubernetes --ref main
   gh workflow run Deploy             -R christochula/oficina-api            --ref main
   ```
4. Isso instala o Datadog Agent no EKS + cria dashboard/monitores/Synthetic.
5. Gerar tráfego (repetir a seção 7 algumas vezes, criar/avançar OS) para as 5
   métricas de negócio aparecerem no Metrics Explorer.

---

## 9. Cleanup (após a gravação)

Ordem **inversa**. Ver `documentacao/operacao/destroy.md`.

```
oficina-api (helm uninstall) → oficina-auth-serverless → oficina-infra-database → oficina-infra-kubernetes
```

Encerrar o lab também limpa a maior parte. Conferir no console: ELB, EKS,
node group (ASG), NAT (não criamos), RDS, ECR.
