data "aws_secretsmanager_secret_version" "app_k8s" {
  count = var.apply_k8s_manifests && var.use_secrets_manager_for_k8s_secrets ? 1 : 0

  secret_id = var.app_k8s_secret_name
}

data "aws_secretsmanager_secret_version" "postgres_k8s" {
  count = var.apply_k8s_manifests && var.use_secrets_manager_for_k8s_secrets ? 1 : 0

  secret_id = var.postgres_k8s_secret_name
}

locals {
  app_k8s_secret_json      = length(data.aws_secretsmanager_secret_version.app_k8s) > 0 ? jsondecode(data.aws_secretsmanager_secret_version.app_k8s[0].secret_string) : {}
  postgres_k8s_secret_json = length(data.aws_secretsmanager_secret_version.postgres_k8s) > 0 ? jsondecode(data.aws_secretsmanager_secret_version.postgres_k8s[0].secret_string) : {}
}

resource "kubernetes_secret_v1" "app" {
  count = var.apply_k8s_manifests && var.use_secrets_manager_for_k8s_secrets ? 1 : 0

  metadata {
    name      = "oficina-api-secret"
    namespace = "oficina-api"
  }

  type = "Opaque"

  data = {
    DATABASE_URL            = try(local.app_k8s_secret_json.DATABASE_URL, "")
    JWT_SECRET              = try(local.app_k8s_secret_json.JWT_SECRET, "")
    JWT_EXPIRATION          = try(local.app_k8s_secret_json.JWT_EXPIRATION, "")
    JWT_REFRESH_SECRET      = try(local.app_k8s_secret_json.JWT_REFRESH_SECRET, "")
    JWT_REFRESH_EXPIRATION  = try(local.app_k8s_secret_json.JWT_REFRESH_EXPIRATION, "")
    ADMIN_SEED_PASSWORD     = try(local.app_k8s_secret_json.ADMIN_SEED_PASSWORD, "")
    ORCAMENTO_WEBHOOK_TOKEN = try(local.app_k8s_secret_json.ORCAMENTO_WEBHOOK_TOKEN, "")
  }

  lifecycle {
    precondition {
      condition = alltrue([
        try(local.app_k8s_secret_json.DATABASE_URL, "") != "",
        try(local.app_k8s_secret_json.JWT_SECRET, "") != "",
        try(local.app_k8s_secret_json.JWT_EXPIRATION, "") != "",
        try(local.app_k8s_secret_json.JWT_REFRESH_SECRET, "") != "",
        try(local.app_k8s_secret_json.JWT_REFRESH_EXPIRATION, "") != "",
        try(local.app_k8s_secret_json.ADMIN_SEED_PASSWORD, "") != "",
        try(local.app_k8s_secret_json.ORCAMENTO_WEBHOOK_TOKEN, "") != ""
      ])
      error_message = "O secret app_k8s_secret_name deve conter todas as chaves obrigatorias da API."
    }
  }

  depends_on = [kubernetes_manifest.namespaces]
}

resource "kubernetes_secret_v1" "postgres" {
  count = var.apply_k8s_manifests && var.use_secrets_manager_for_k8s_secrets ? 1 : 0

  metadata {
    name      = "postgres-secret"
    namespace = "oficina-api"
  }

  type = "Opaque"

  data = {
    POSTGRES_PASSWORD = try(local.postgres_k8s_secret_json.POSTGRES_PASSWORD, "")
  }

  lifecycle {
    precondition {
      condition     = try(local.postgres_k8s_secret_json.POSTGRES_PASSWORD, "") != ""
      error_message = "O secret postgres_k8s_secret_name deve conter a chave POSTGRES_PASSWORD."
    }
  }

  depends_on = [kubernetes_manifest.namespaces]
}
