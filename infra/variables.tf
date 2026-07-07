variable "aws_region" {
  description = "Regiao da AWS"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nome base do projeto"
  type        = string
  default     = "oficina-api"
}

variable "environment" {
  description = "Ambiente alvo (dev, hom, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR da VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Lista de sub-redes publicas"
  type        = list(string)
  default     = ["10.20.0.0/24", "10.20.1.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Lista de sub-redes privadas"
  type        = list(string)
  default     = ["10.20.10.0/24", "10.20.11.0/24"]
}

variable "db_name" {
  description = "Nome do banco PostgreSQL"
  type        = string
  default     = "oficina_db"
}

variable "db_username" {
  description = "Usuario do banco"
  type        = string
  default     = "oficina"
}

variable "db_password" {
  description = "Senha do banco"
  type        = string
  sensitive   = true
  default     = ""
}

variable "db_password_secret_name" {
  description = "Nome do secret no AWS Secrets Manager para senha do RDS. Usado quando db_password estiver vazio."
  type        = string
  default     = ""
}

variable "db_password_secret_key" {
  description = "Chave dentro do JSON do secret da senha do RDS. Se o secret for string plana, este campo e ignorado."
  type        = string
  default     = "db_password"
}

variable "db_instance_class" {
  description = "Classe da instancia RDS"
  type        = string
  default     = "db.t4g.micro"
}

variable "desired_size" {
  description = "Quantidade desejada de nodes EKS"
  type        = number
  default     = 2
}

variable "min_size" {
  description = "Quantidade minima de nodes EKS"
  type        = number
  default     = 1
}

variable "max_size" {
  description = "Quantidade maxima de nodes EKS"
  type        = number
  default     = 3
}

variable "cluster_iam_role_name" {
  description = "Nome da role IAM preexistente para o cluster EKS (Talent Lab). Se vazio, Terraform cria role."
  type        = string
  default     = ""
}

variable "node_iam_role_name" {
  description = "Nome da role IAM preexistente para nodes EKS (Talent Lab). Se vazio, Terraform cria role."
  type        = string
  default     = ""
}

variable "cluster_admin_role_name" {
  description = "Nome da role IAM que recebera permissao de administrador no cluster EKS (ex.: voclabs)."
  type        = string
  default     = "voclabs"
}

variable "apply_k8s_manifests" {
  description = "Quando true, aplica os manifestos Kubernetes declarativos via Terraform."
  type        = bool
  default     = false
}

variable "deploy_k8s_postgres" {
  description = "Quando true, tambem aplica o PostgreSQL dentro do Kubernetes. Para AWS Academy, prefira false e use o RDS provisionado pelo Terraform."
  type        = bool
  default     = false
}

variable "app_image" {
  description = "Imagem Docker completa para Deployment e Job de migration. Se vazio, usa a imagem definida nos manifests YAML."
  type        = string
  default     = ""
}

variable "use_secrets_manager_for_k8s_secrets" {
  description = "Quando true, cria os Secrets do Kubernetes a partir do AWS Secrets Manager em vez de YAML versionado."
  type        = bool
  default     = true
}

variable "app_k8s_secret_name" {
  description = "Nome do secret no AWS Secrets Manager com as chaves do Secret oficina-api-secret."
  type        = string
  default     = ""
}

variable "postgres_k8s_secret_name" {
  description = "Nome do secret no AWS Secrets Manager com a chave POSTGRES_PASSWORD para o Secret postgres-secret."
  type        = string
  default     = ""
}
