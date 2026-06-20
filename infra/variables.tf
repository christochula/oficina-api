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
