# Infraestrutura com Terraform (AWS)

Esta pasta provisiona:

1. VPC com sub-redes publicas e privadas.
2. Cluster Kubernetes gerenciado no EKS.
3. Banco PostgreSQL no Amazon RDS.
4. Aplicacao declarativa dos manifestos Kubernetes em camadas (namespace, config, database, app, autoscaling).

## Pre-requisitos

1. Terraform 1.6+
2. AWS CLI autenticado
3. Permissoes para criar VPC, EKS, RDS, IAM, EC2 e CloudWatch

## Arquivos

1. providers.tf: providers e configuracao AWS/Kubernetes
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
   - app_k8s_secret_name
   - postgres_k8s_secret_name

3. Inicialize o Terraform:

   terraform init

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

   terraform apply -var="apply_k8s_manifests=true"

## Segredos via AWS Secrets Manager

Para nao manter segredos em codigo/YAML:

1. Configure no `terraform.tfvars`:

    - `db_password = ""`
    - `db_password_secret_name = "oficina-api/dev/rds"`
    - `db_password_secret_key = "db_password"`
    - `use_secrets_manager_for_k8s_secrets = true`
    - `app_k8s_secret_name = "oficina-api/dev/k8s/app"`
    - `postgres_k8s_secret_name = "oficina-api/dev/k8s/postgres"`

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

    Secret `oficina-api/dev/k8s/postgres`:

    {
       "POSTGRES_PASSWORD": "SenhaSegura123!"
    }

3. Com `use_secrets_manager_for_k8s_secrets=true`, o Terraform ignora `k8s/01-config/app-secret.yaml` e `k8s/02-database/postgres-secret.yaml` e cria os Secrets Kubernetes a partir do Secrets Manager.

## Fluxo rapido para gravacao (Talent Lab)

1. Exportar credenciais da sessao ativa no terminal.
2. Rodar:

   terraform init
   ./scripts/patch-eks-talent-lab.sh
   terraform validate
   terraform plan -var="apply_k8s_manifests=false"
   terraform apply -var="apply_k8s_manifests=false"

3. Depois subir manifests:

   terraform plan -var="apply_k8s_manifests=true"
   terraform apply -var="apply_k8s_manifests=true"

## Checklist de rerun sem erro

1. Sessao AWS valida (STS funcionando e sem token expirado).
2. `terraform.tfvars` preenchido com nomes de roles e nomes dos secrets.
3. Secrets existem no AWS Secrets Manager com todas as chaves exigidas.
4. `terraform init`.
5. `./scripts/patch-eks-talent-lab.sh` (Talent Lab).
6. `terraform validate`.
7. `terraform apply -var="apply_k8s_manifests=false"`.
8. Garantir que o repositorio ECR exista (`oficina-api`). Se nao existir, criar antes do push:

   aws ecr create-repository --repository-name oficina-api --region us-east-1

9. Build/push da imagem para ECR (`:latest`) antes do deploy da app.
10. `terraform apply -var="apply_k8s_manifests=true"`.
11. Verificar: `kubectl -n oficina-api get deploy,svc,hpa,pods,pvc`.

## GitHub Actions para deploy

Se for usar o workflow de CD para o video, configure estes secrets no repositório ou environment do GitHub:

- `AWS_ROLE_ARN`
- `AWS_REGION`
- `DB_PASSWORD_SECRET_NAME`
- `APP_K8S_SECRET_NAME`
- `POSTGRES_K8S_SECRET_NAME`
- `CLUSTER_IAM_ROLE_NAME` e `NODE_IAM_ROLE_NAME` se estiver usando roles preexistentes no Talent Lab
- `CLUSTER_ADMIN_ROLE_NAME` para garantir que o role assumido pelo workflow tenha acesso ao cluster EKS

O workflow agora:

1. Garante o repositorio ECR `oficina-api` antes do push.
2. Faz o apply da infraestrutura base.
3. Faz o apply dos manifests Kubernetes.
4. Consome apenas nomes de secrets do Secrets Manager, nunca senhas em texto puro.
5. Usa os nomes das roles do Talent Lab para criar o acesso EKS correto para o role do deploy.

## Como destruir

terraform destroy

## Integracao com Kubernetes

O Terraform aplica os manifests Kubernetes declarativamente com resource kubernetes_manifest.

Organizacao esperada dos manifestos:

1. k8s/00-namespaces
2. k8s/01-config
3. k8s/02-database
4. k8s/04-app
5. k8s/05-autoscaling

Ordem de aplicacao (depends_on):

1. namespaces
2. config
3. database
4. app
5. autoscaling

## AWS Talent Lab (roles preexistentes)

Se sua conta do laboratorio nao permitir criacao de IAM roles, informe roles existentes:

- cluster_iam_role_name
- node_iam_role_name

O projeto busca essas roles com data aws_iam_role e injeta os ARNs no EKS.

## Observacao academica

Banco em manifestos Kubernetes e adequado para laboratorio/avaliacao academica.
Em producao, prefira servicos gerenciados e arquitetura de alta disponibilidade.
