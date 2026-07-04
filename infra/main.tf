locals {
  name                   = "${var.project_name}-${var.environment}"
  use_existing_iam_roles = var.cluster_iam_role_name != "" && var.node_iam_role_name != ""

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

data "aws_iam_role" "cluster" {
  count = local.use_existing_iam_roles ? 1 : 0
  name  = var.cluster_iam_role_name
}

data "aws_iam_role" "node" {
  count = local.use_existing_iam_roles ? 1 : 0
  name  = var.node_iam_role_name
}

data "aws_caller_identity" "current" {}

data "aws_secretsmanager_secret_version" "db_password" {
  count = var.db_password == "" && var.db_password_secret_name != "" ? 1 : 0

  secret_id = var.db_password_secret_name
}

locals {
  db_password_secret_raw = length(data.aws_secretsmanager_secret_version.db_password) > 0 ? data.aws_secretsmanager_secret_version.db_password[0].secret_string : ""
  db_password_from_json  = try(jsondecode(local.db_password_secret_raw)[var.db_password_secret_key], "")
  db_password_resolved   = var.db_password != "" ? var.db_password : (local.db_password_from_json != "" ? local.db_password_from_json : local.db_password_secret_raw)
}

data "aws_availability_zones" "available" {
  state = "available"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.8.1"

  name = local.name
  cidr = var.vpc_cidr

  azs             = slice(data.aws_availability_zones.available.names, 0, 2)
  public_subnets  = var.public_subnet_cidrs
  private_subnets = var.private_subnet_cidrs

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
  }

  tags = local.common_tags
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.17.2"

  cluster_name    = local.name
  cluster_version = "1.30"

  cluster_endpoint_public_access = true
  enable_irsa                    = false
  access_entries = {
    admin_role = {
      principal_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.cluster_admin_role_name}"

      policy_associations = {
        admin = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = {
            type = "cluster"
          }
        }
      }
    }
  }
  create_iam_role = !local.use_existing_iam_roles
  iam_role_arn    = local.use_existing_iam_roles ? data.aws_iam_role.cluster[0].arn : null

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    principal = {
      instance_types  = ["t3.medium"]
      create_iam_role = !local.use_existing_iam_roles
      iam_role_arn    = local.use_existing_iam_roles ? data.aws_iam_role.node[0].arn : null

      min_size     = var.min_size
      max_size     = var.max_size
      desired_size = var.desired_size
    }
  }

  tags = local.common_tags
}

resource "aws_security_group" "rds" {
  name        = "${local.name}-rds-sg"
  description = "Security group do PostgreSQL"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "PostgreSQL na VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_db_subnet_group" "this" {
  name       = "${local.name}-db-subnets"
  subnet_ids = module.vpc.private_subnets

  tags = local.common_tags
}

resource "aws_db_instance" "postgres" {
  identifier = "${replace(local.name, "_", "-")}-postgres"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = local.db_password_resolved

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.this.name

  backup_retention_period = 7
  deletion_protection     = false
  skip_final_snapshot     = true
  publicly_accessible     = false

  lifecycle {
    precondition {
      condition     = length(local.db_password_resolved) > 0
      error_message = "Defina db_password ou configure db_password_secret_name no Secrets Manager."
    }
  }

  tags = local.common_tags
}
