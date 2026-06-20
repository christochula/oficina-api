# Infraestrutura com Terraform (AWS)

Esta pasta provisiona:

1. VPC com sub-redes publicas e privadas.
2. Cluster Kubernetes gerenciado no EKS.
3. Banco PostgreSQL no Amazon RDS.

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

## Como aplicar

1. Copie o arquivo de exemplo:

   cp terraform.tfvars.example terraform.tfvars

2. Ajuste principalmente:

   - db_password
   - aws_region
   - environment

3. Inicialize o Terraform:

   terraform init

4. Valide:

   terraform validate

5. Veja o plano:

   terraform plan

6. Aplique:

   terraform apply

## Como destruir

terraform destroy

## Integracao com Kubernetes

Apos o apply:

1. Configure o kubectl para o cluster EKS criado.
2. Atualize o k8s/secret.yaml com o endpoint real do RDS.
3. Aplique os manifestos da pasta k8s.
