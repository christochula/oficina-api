locals {
  k8s_base_path = "${path.root}/../k8s"

  namespace_files = fileset("${local.k8s_base_path}/00-namespaces", "*.yaml")
  config_files = var.use_secrets_manager_for_k8s_secrets ? [
    for file in fileset("${local.k8s_base_path}/01-config", "*.yaml") : file
    if file != "app-secret.yaml"
  ] : fileset("${local.k8s_base_path}/01-config", "*.yaml")
  database_files = var.use_secrets_manager_for_k8s_secrets ? [
    for file in fileset("${local.k8s_base_path}/02-database", "*.yaml") : file
    if file != "postgres-secret.yaml"
  ] : fileset("${local.k8s_base_path}/02-database", "*.yaml")
  app_files       = fileset("${local.k8s_base_path}/04-app", "*.yaml")
  autoscale_files = fileset("${local.k8s_base_path}/05-autoscaling", "*.yaml")
}

resource "kubernetes_manifest" "namespaces" {
  for_each = var.apply_k8s_manifests ? toset(local.namespace_files) : toset([])
  manifest = yamldecode(file("${local.k8s_base_path}/00-namespaces/${each.value}"))

  depends_on = [module.eks]
}

resource "kubernetes_manifest" "config" {
  for_each = var.apply_k8s_manifests ? toset(local.config_files) : toset([])
  manifest = yamldecode(file("${local.k8s_base_path}/01-config/${each.value}"))

  depends_on = [kubernetes_manifest.namespaces]
}

resource "kubernetes_manifest" "database" {
  for_each = var.apply_k8s_manifests ? toset(local.database_files) : toset([])
  manifest = yamldecode(file("${local.k8s_base_path}/02-database/${each.value}"))

  depends_on = [kubernetes_manifest.config, kubernetes_secret_v1.postgres]
}

resource "kubernetes_manifest" "app" {
  for_each = var.apply_k8s_manifests ? toset(local.app_files) : toset([])
  manifest = yamldecode(file("${local.k8s_base_path}/04-app/${each.value}"))

  depends_on = [kubernetes_manifest.database, kubernetes_secret_v1.app]
}

resource "kubernetes_manifest" "autoscaling" {
  for_each = var.apply_k8s_manifests ? toset(local.autoscale_files) : toset([])
  manifest = yamldecode(file("${local.k8s_base_path}/05-autoscaling/${each.value}"))

  depends_on = [kubernetes_manifest.app]
}
