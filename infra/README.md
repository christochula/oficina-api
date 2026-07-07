# Infraestrutura com Terraform (AWS)

Esta pasta provisiona:

1. VPC com sub-redes publicas e privadas.
2. Cluster Kubernetes gerenciado no EKS.
3. Banco PostgreSQL no Amazon RDS.
4. Aplicacao declarativa dos manifestos Kubernetes em camadas (namespace, config, database opcional, metrics, migrations, app, autoscaling).

## Pre-requisitos

1. Terraform 1.6+
2. AWS CLI autenticado
3. Permissoes para criar VPC, EKS, RDS, IAM, EC2, CloudWatch e S3

## Arquivos

1. providers.tf: providers, backend S3 e configuracao AWS/Kubernetes
2. variables.tf: variaveis do projeto
3. main.tf: recursos principais (VPC, EKS, RDS)
4. outputs.tf: saidas uteis para deploy
5. terraform.tfvars.example: exemplo de parametros
6. manifests.tf: orquestracao declarativa dos manifestos Kubernetes via resource kubernetes_manifest

## Como aplicar

1. Copie o arquivo de exemplo:

   cp terraform.tfvars.example terraform.tfvars

2. Ajuste principalmente:

   - db_password (ou db_password_secret_name)
   - aws_region
   - environment
   - cluster_iam_role_name (quando usar role preexistente no Talent Lab)
   - node_iam_role_name (quando usar role preexistente no Talent Lab)
   - cluster_admin_role_name (ex.: voclabs no Talent Lab)
   - require_existing_iam_roles (true recomendado no AWS Academy)
   - app_k8s_secret_name
   - deploy_k8s_postgres (false recomendado no AWS Academy)
   - app_image (preenchido automaticamente pelo GitHub Actions no CD)
   - postgres_k8s_secret_name (somente se deploy_k8s_postgres=true)

3. Inicialize o Terraform:

   terraform init \
     -backend-config="bucket=oficina-api-tfstate-<aws-account-id>-<aws-region>" \
     -backend-config="key=oficina-api/prod/terraform.tfstate" \
     -backend-config="region=<aws-region>" \
     -backend-config="encrypt=true"

   Em conta AWS Talent Lab, rode tambem:

   ./scripts/patch-eks-talent-lab.sh

4. Formate e valide:

   terraform fmt -check -recursive
   terraform validate

5. Veja o plano:

   terraform plan

6. Aplique:

   terraform apply

Recomendacao para evitar falha no primeiro bootstrap:

1. Primeiro apply so da infraestrutura base (EKS, VPC, RDS):

   terraform apply -var="apply_k8s_manifests=false"

2. Depois apply dos manifestos Kubernetes declarativos:

   terraform apply -var="apply_k8s_manifests=true" -var="deploy_k8s_postgres=false"

## Segredos via AWS Secrets Manager

Para nao manter segredos em codigo/YAML:

1. Configure no `terraform.tfvars`:

    - `db_password = ""`
    - `db_password_secret_name = "oficina-api/dev/rds"`
    - `db_password_secret_key = "db_password"`
    - `use_secrets_manager_for_k8s_secrets = true`
    - `app_k8s_secret_name = "oficina-api/dev/k8s/app"`
    - `deploy_k8s_postgres = false`
    - `app_image = ""` para uso local, ou preenchido pelo GitHub Actions no CD
    - `require_existing_iam_roles = true`
    - `postgres_k8s_secret_name = "oficina-api/dev/k8s/postgres"` somente se tambem for aplicar Postgres dentro do Kubernetes

2. Crie os secrets no Secrets Manager com payload JSON:

    Secret `oficina-api/dev/rds`:

    {
       "db_password": "SenhaSegura123!"
    }

    Secret `oficina-api/dev/k8s/app`:

    {
       "DATABASE_URL": "postgresql://oficina:SenhaSegura123!@postgres-service:5432/oficina_db",
       "JWT_SECRET": "...",
       "JWT_EXPIRATION": "15m",
       "JWT_REFRESH_SECRET": "...",
       "JWT_REFRESH_EXPIRATION": "7d",
       "ADMIN_SEED_PASSWORD": "...",
       "ORCAMENTO_WEBHOOK_TOKEN": "..."
    }

    No workflow de CD, `DATABASE_URL` e sobrescrita automaticamente com o endpoint RDS atual antes do apply dos manifests.

    Secret opcional `oficina-api/dev/k8s/postgres`:

    {
       "POSTGRES_PASSWORD": "SenhaSegura123!"
    }

3. Com `use_secrets_manager_for_k8s_secrets=true`, o Terraform ignora `k8s/01-config/app-secret.yaml` e cria o Secret Kubernetes da aplicacao a partir do Secrets Manager. Ele so usa `k8s/02-database/postgres-secret.yaml` ou `postgres_k8s_secret_name` quando `deploy_k8s_postgres=true`.

## Fluxo rapido para gravacao (Talent Lab)

1. Exportar credenciais da sessao ativa no terminal.
2. Rodar:

   terraform init \
     -backend-config="bucket=oficina-api-tfstate-<aws-account-id>-<aws-region>" \
     -backend-config="key=oficina-api/prod/terraform.tfstate" \
     -backend-config="region=<aws-region>" \
     -backend-config="encrypt=true"
   ./scripts/patch-eks-talent-lab.sh
   terraform validate
   terraform plan -var="apply_k8s_manifests=false"
   terraform apply -var="apply_k8s_manifests=false" -var="deploy_k8s_postgres=false"

3. Depois subir manifests:

   terraform plan -var="apply_k8s_manifests=true"
   terraform apply -var="apply_k8s_manifests=true" -var="deploy_k8s_postgres=false"

## Checklist de rerun sem erro

1. Sessao AWS valida (STS funcionando e sem token expirado).
2. `terraform.tfvars` preenchido com nomes de roles e nomes dos secrets.
3. Secrets obrigatorios existem no AWS Secrets Manager com todas as chaves exigidas.
4. Bucket S3 de state existe ou o workflow tem permissao para cria-lo.
5. `terraform init` com backend S3.
6. `./scripts/patch-eks-talent-lab.sh` (Talent Lab).
7. `terraform validate`.
8. `terraform apply -var="apply_k8s_manifests=false" -var="deploy_k8s_postgres=false"`.
9. Garantir que o repositorio ECR exista (`oficina-api`). Se nao existir, criar antes do push:

   aws ecr create-repository --repository-name oficina-api --region us-east-1

10. Build/push da imagem para ECR (`:latest`) antes do deploy da app.
11. `terraform apply -var="apply_k8s_manifests=true" -var="deploy_k8s_postgres=false"`.
12. Verificar: `kubectl -n oficina-api get deploy,svc,hpa,pods,job`.

## GitHub Actions para deploy

Se for usar o workflow de CD para o video, configure estes secrets no repositório ou environment do GitHub:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` quando usar AWS Academy sem OIDC
- `AWS_ROLE_ARN` somente quando OIDC estiver disponivel
- `DB_PASSWORD_SECRET_NAME`
- `APP_K8S_SECRET_NAME`
- `POSTGRES_K8S_SECRET_NAME` somente se `deploy_k8s_postgres=true`
- `CLUSTER_IAM_ROLE_NAME` e `NODE_IAM_ROLE_NAME` se estiver usando roles preexistentes no Talent Lab
- `CLUSTER_ADMIN_ROLE_NAME` para garantir que o role assumido pelo workflow tenha acesso ao cluster EKS

O workflow agora:

1. Garante o repositorio ECR `oficina-api` antes do push.
2. Resolve o account ID atual e publica a imagem no ECR dessa conta.
3. Passa a imagem publicada ao Terraform por `app_image`.
4. Garante um bucket S3 para o state do Terraform.
5. Faz o apply da infraestrutura base.
6. Faz o apply dos manifests Kubernetes.
7. Consome apenas nomes de secrets do Secrets Manager, nunca senhas em texto puro.
8. Usa os nomes das roles do Talent Lab para criar o acesso EKS correto para o role do deploy.

## Como destruir

terraform destroy

## Integracao com Kubernetes

O Terraform aplica os manifests Kubernetes declarativamente com resource kubernetes_manifest.

Organizacao esperada dos manifestos:

1. k8s/00-namespaces
2. k8s/01-config
3. k8s/02-database (opcional no Terraform; desligado por padrao no caminho AWS Academy)
4. k8s/03-messaging
5. k8s/03-migrations
6. k8s/04-app
7. k8s/05-autoscaling

Ordem de aplicacao (depends_on):

1. namespaces
2. config
3. database opcional
4. metrics
5. migrations
6. app
7. autoscaling

## AWS Talent Lab (roles preexistentes)

Se sua conta do laboratorio nao permitir criacao de IAM roles, informe roles existentes:

- cluster_iam_role_name
- node_iam_role_name
- require_existing_iam_roles = true

O projeto busca essas roles com data aws_iam_role e injeta os ARNs no EKS. Use o nome da role, nao o ARN, e nao deixe os valores vazios. Em muitos labs AWS Academy a role se chama `LabRole`, mas confirme no IAM do seu lab.

## Observacao academica

Banco em manifestos Kubernetes e adequado para laboratorio/avaliacao academica.
Em producao, prefira servicos gerenciados e arquitetura de alta disponibilidade.
