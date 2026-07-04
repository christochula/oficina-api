# Guia de Configuracao do Deploy com GitHub Actions, Terraform e Secrets Manager

Este guia resume, em ordem pratica, o que configurar para subir e depois recriar o ambiente sem deixar segredos em codigo.

## Objetivo

- Guardar senhas e tokens no AWS Secrets Manager.
- Deixar o GitHub Actions apenas com nomes de secrets e permissao de acesso na AWS.
- Usar Terraform para criar a infraestrutura e aplicar os manifestos Kubernetes.
- Publicar a imagem da aplicacao no ECR antes do deploy dos manifests.

## O que configurar no GitHub

No repositório do GitHub, acesse:

- `Settings`
- `Secrets and variables`
- `Actions`
- `New repository secret`

Crie estes secrets:

- `AWS_ROLE_ARN`
- `AWS_REGION`
- `DB_PASSWORD_SECRET_NAME`
- `APP_K8S_SECRET_NAME`
- `POSTGRES_K8S_SECRET_NAME`
- `CLUSTER_IAM_ROLE_NAME`
- `NODE_IAM_ROLE_NAME`
- `CLUSTER_ADMIN_ROLE_NAME`

### O que cada secret faz

- `AWS_ROLE_ARN`: role que o GitHub Actions assume na AWS.
- `AWS_REGION`: regiao da AWS, normalmente `us-east-1`.
- `DB_PASSWORD_SECRET_NAME`: nome do secret do RDS no AWS Secrets Manager.
- `APP_K8S_SECRET_NAME`: nome do secret da aplicacao no AWS Secrets Manager.
- `POSTGRES_K8S_SECRET_NAME`: nome do secret do Postgres no AWS Secrets Manager.
- `CLUSTER_IAM_ROLE_NAME`: nome da role IAM preexistente do cluster EKS, se usar o Talent Lab.
- `NODE_IAM_ROLE_NAME`: nome da role IAM preexistente dos nodes EKS, se usar o Talent Lab.
- `CLUSTER_ADMIN_ROLE_NAME`: role que recebera permissao de admin no cluster EKS. No Talent Lab, normalmente `voclabs`.

## O que criar no AWS Secrets Manager

Crie estes 3 secrets na AWS:

1. `oficina-api/dev/rds`
2. `oficina-api/dev/k8s/app`
3. `oficina-api/dev/k8s/postgres`

### Conteudo de cada secret

#### 1. `oficina-api/dev/rds`

Use um JSON com a chave:

```json
{
  "db_password": "SenhaSegura123!"
}
```

#### 2. `oficina-api/dev/k8s/app`

Use um JSON com as chaves abaixo:

```json
{
  "DATABASE_URL": "postgresql://oficina:SenhaSegura123!@postgres-service:5432/oficina_db",
  "JWT_SECRET": "troque-por-um-segredo-forte",
  "JWT_EXPIRATION": "15m",
  "JWT_REFRESH_SECRET": "troque-por-outro-segredo-forte",
  "JWT_REFRESH_EXPIRATION": "7d",
  "ADMIN_SEED_PASSWORD": "troque-a-senha-do-admin",
  "ORCAMENTO_WEBHOOK_TOKEN": "troque-o-token-do-webhook"
}
```

#### 3. `oficina-api/dev/k8s/postgres`

Use um JSON com a chave:

```json
{
  "POSTGRES_PASSWORD": "SenhaSegura123!"
}
```

## O que vai no Terraform

No arquivo `infra/terraform.tfvars` local, configure:

- `db_password = ""`
- `db_password_secret_name = "oficina-api/dev/rds"`
- `db_password_secret_key = "db_password"`
- `use_secrets_manager_for_k8s_secrets = true`
- `app_k8s_secret_name = "oficina-api/dev/k8s/app"`
- `postgres_k8s_secret_name = "oficina-api/dev/k8s/postgres"`
- `cluster_iam_role_name = "<nome-da-role-do-cluster-no-talent-lab>"` se usar role preexistente
- `node_iam_role_name = "<nome-da-role-dos-nodes-no-talent-lab>"` se usar role preexistente
- `cluster_admin_role_name = "voclabs"` no Talent Lab, ou outra role que tenha acesso ao cluster

## Passo a passo para subir tudo

### 1. Validar a conta AWS

Confirme que a sessao AWS esta ativa:

```bash
aws sts get-caller-identity
```

### 2. Criar os secrets na AWS

Crie os 3 secrets no AWS Secrets Manager com os nomes e JSONs acima.

### 3. Configurar o GitHub

Adicione os secrets do GitHub listados acima no repositório.

### 4. Preparar o Terraform

Na pasta `infra`:

```bash
terraform init
./scripts/patch-eks-talent-lab.sh
terraform validate
```

### 5. Subir a infraestrutura base

Primeiro suba a base sem os manifests Kubernetes:

```bash
terraform apply -auto-approve -input=false -no-color -var="apply_k8s_manifests=false"
```

### 6. Garantir que o ECR exista

Se o repositório ECR tiver sido removido, recrie antes do push:

```bash
aws ecr create-repository --repository-name oficina-api --region us-east-1
```

### 7. Build e push da imagem

Build da imagem e push para o ECR com a tag `latest`.

### 8. Aplicar os manifests Kubernetes

Depois rode o deploy dos manifests:

```bash
terraform apply -auto-approve -input=false -no-color -var="apply_k8s_manifests=true"
```

### 9. Validar o cluster

Verifique os recursos no namespace da aplicacao:

```bash
kubectl -n oficina-api get deploy,svc,hpa,pods,pvc
```

## O fluxo real de informacoes

1. O GitHub Actions inicia o pipeline.
2. Ele faz build e testes da aplicacao.
3. Ele autentica na AWS com a role configurada.
4. Ele garante que o ECR exista.
5. Ele faz build e push da imagem Docker.
6. Ele chama o Terraform.
7. O Terraform cria ou atualiza a infraestrutura na AWS.
8. O Terraform le os segredos no AWS Secrets Manager.
9. O Terraform cria os Secrets do Kubernetes a partir desses valores.
10. O Terraform aplica os manifests.
11. O EKS sobe os pods da aplicacao e do Postgres.
12. A aplicacao usa a imagem do ECR e os segredos montados no cluster.

## O que cada ferramenta faz

### AWS Secrets Manager

- Guarda os segredos reais.
- Evita que senhas fiquem no codigo ou no YAML.
- Atende a parte de seguranca e organizacao dos secrets.

### Terraform

- Cria a infraestrutura da AWS.
- Cria EKS, VPC, RDS e recursos de rede.
- Aplica os manifests Kubernetes.
- Le os segredos do Secrets Manager.

### GitHub Actions

- Orquestra o pipeline.
- Faz build, testes, publish da imagem e chamada do Terraform.
- Automatiza o deploy.

## Checklist rapido para nao errar

- [ ] A sessao AWS esta valida.
- [ ] Os 3 secrets existem no AWS Secrets Manager.
- [ ] Os secrets do GitHub estao configurados.
- [ ] O ECR existe.
- [ ] O Terraform foi inicializado.
- [ ] O patch do Talent Lab foi aplicado.
- [ ] A base foi aplicada com `apply_k8s_manifests=false`.
- [ ] A imagem foi publicada no ECR.
- [ ] Os manifests foram aplicados com `apply_k8s_manifests=true`.
- [ ] O namespace `oficina-api` tem os recursos esperados.

## Observacao importante

Os segredos nao ficam em texto puro no codigo, mas ainda podem aparecer no state do Terraform dependendo do recurso que os consome. Para o video e para o laboratorio, o fluxo acima atende bem. Para ambiente mais serio, o ideal e usar backend remoto protegido para o state e revisar politicas de acesso.

## Ordem mais segura para o dia do deploy

1. Criar os secrets no AWS Secrets Manager.
2. Configurar os secrets do GitHub.
3. Rodar Terraform base.
4. Fazer build e push da imagem no ECR.
5. Aplicar os manifests.
6. Validar com `kubectl`.
7. Se estiver tudo certo, gravar a demonstracao.

## Se quiser destruir depois

Quando terminar, pode remover tudo com:

```bash
terraform destroy -auto-approve -input=false -no-color -var="apply_k8s_manifests=true"
```

Se estiver usando o modo de Secrets Manager, mantenha `use_secrets_manager_for_k8s_secrets=false` na destruicao caso os secrets ainda nao estejam configurados no momento do destroy.
