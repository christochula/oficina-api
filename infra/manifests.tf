locals {
  k8s_base_path = "${path.root}/../k8s"

  namespace_files = fileset("${local.k8s_base_path}/00-namespaces", "*.yaml")
  config_files = var.use_secrets_manager_for_k8s_secrets ? [
    for file in fileset("${local.k8s_base_path}/01-config", "*.yaml") : file
    if file != "app-secret.yaml"
  ] : fileset("${local.k8s_base_path}/01-config", "*.yaml")
  metrics_files   = fileset("${local.k8s_base_path}/03-messaging", "*.yaml")
  migration_files = fileset("${local.k8s_base_path}/03-migrations", "*.yaml")
  database_files = var.deploy_k8s_postgres ? (var.use_secrets_manager_for_k8s_secrets ? [
    for file in fileset("${local.k8s_base_path}/02-database", "*.yaml") : file
    if file != "postgres-secret.yaml"
  ] : fileset("${local.k8s_base_path}/02-database", "*.yaml")) : []
  app_files       = fileset("${local.k8s_base_path}/04-app", "*.yaml")
  autoscale_files = fileset("${local.k8s_base_path}/05-autoscaling", "*.yaml")

  migration_manifests = {
    for file in local.migration_files : file => yamldecode(file("${local.k8s_base_path}/03-migrations/${file}"))
  }
  app_manifests = {
    for file in local.app_files : file => yamldecode(file("${local.k8s_base_path}/04-app/${file}"))
  }
}

resource "terraform_data" "migration_rollout" {
  triggers_replace = concat(
    [var.app_image],
    [for file in sort(tolist(local.migration_files)) : filesha256("${local.k8s_base_path}/03-migrations/${file}")]
  )
}

resource "terraform_data" "validate_k8s_app_image" {
  input = var.app_image

  lifecycle {
    precondition {
      condition     = !var.apply_k8s_manifests || trimspace(var.app_image) != ""
      error_message = "Defina app_image com a imagem ECR publicada antes de aplicar manifests Kubernetes. O CD preenche automaticamente; em deploy manual, use -var=\"app_image=<account>.dkr.ecr.<region>.amazonaws.com/oficina-api:<tag>\"."
    }
  }
}

resource "kubernetes_manifest" "namespaces" {
  for_each = var.apply_k8s_manifests ? toset(local.namespace_files) : toset([])
  manifest = yamldecode(file("${local.k8s_base_path}/00-namespaces/${each.value}"))

  depends_on = [module.eks, terraform_data.validate_k8s_app_image]
}

resource "kubernetes_manifest" "config" {
  for_each = var.apply_k8s_manifests ? toset(local.config_files) : toset([])
  manifest = yamldecode(file("${local.k8s_base_path}/01-config/${each.value}"))

  depends_on = [kubernetes_manifest.namespaces]
}

resource "kubernetes_manifest" "metrics" {
  for_each = var.apply_k8s_manifests ? toset(local.metrics_files) : toset([])
  manifest = yamldecode(file("${local.k8s_base_path}/03-messaging/${each.value}"))

  depends_on = [kubernetes_manifest.namespaces]
}

resource "kubernetes_manifest" "database" {
  for_each = var.apply_k8s_manifests ? toset(local.database_files) : toset([])
  manifest = yamldecode(file("${local.k8s_base_path}/02-database/${each.value}"))

  depends_on = [kubernetes_manifest.config, kubernetes_secret_v1.postgres]
}

resource "kubernetes_manifest" "migrations" {
  for_each = var.apply_k8s_manifests ? toset(local.migration_files) : toset([])
  manifest = var.app_image != "" ? merge(local.migration_manifests[each.value], {
    spec = merge(local.migration_manifests[each.value].spec, {
      template = merge(local.migration_manifests[each.value].spec.template, {
        spec = merge(local.migration_manifests[each.value].spec.template.spec, {
          containers = [
            for container in local.migration_manifests[each.value].spec.template.spec.containers :
            container.name == "migrate" ? merge(container, { image = var.app_image }) : container
          ]
        })
      })
    })
  }) : local.migration_manifests[each.value]

  computed_fields = [
    "spec.selector",
    "spec.template.metadata.labels",
  ]

  wait {
    fields = {
      "status.succeeded" = "1"
    }
  }

  timeouts {
    create = "20m"
    update = "20m"
    delete = "5m"
  }

  lifecycle {
    replace_triggered_by = [terraform_data.migration_rollout]
  }

  depends_on = [kubernetes_manifest.config, kubernetes_manifest.database, kubernetes_secret_v1.app]
}

resource "kubernetes_manifest" "app" {
  for_each = var.apply_k8s_manifests ? toset(local.app_files) : toset([])
  manifest = each.value == "deployment.yaml" && var.app_image != "" ? merge(local.app_manifests[each.value], {
    spec = merge(local.app_manifests[each.value].spec, {
      template = merge(local.app_manifests[each.value].spec.template, {
        spec = merge(local.app_manifests[each.value].spec.template.spec, {
          containers = [
            for container in local.app_manifests[each.value].spec.template.spec.containers :
            container.name == "oficina-api" ? merge(container, { image = var.app_image }) : container
          ]
        })
      })
    })
  }) : local.app_manifests[each.value]

  depends_on = [kubernetes_manifest.migrations]
}

resource "kubernetes_manifest" "autoscaling" {
  for_each = var.apply_k8s_manifests ? toset(local.autoscale_files) : toset([])
  manifest = yamldecode(file("${local.k8s_base_path}/05-autoscaling/${each.value}"))

  depends_on = [kubernetes_manifest.app, kubernetes_manifest.metrics]
}
