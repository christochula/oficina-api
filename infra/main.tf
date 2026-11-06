terraform {
  required_version = ">= 1.10"
  backend "s3" {}
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}
provider "aws" { region = var.aws_region }
variable "aws_region" { default = "us-east-1" }
variable "environment" { default = "homolog" }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "node_security_group_id" { type = string }
locals { name = "oficina-fase4-os-${var.environment}" }
resource "random_password" "db" {
  length  = 32
  special = false
}
resource "aws_security_group" "db" {
  name   = "${local.name}-db"
  vpc_id = var.vpc_id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.node_security_group_id]
  }
}
resource "aws_db_subnet_group" "db" {
  name       = local.name
  subnet_ids = var.subnet_ids
}
resource "aws_db_instance" "db" {
  identifier                = local.name
  engine                    = "postgres"
  engine_version            = "16"
  instance_class            = "db.t3.micro"
  allocated_storage         = 20
  max_allocated_storage     = 40
  storage_encrypted         = true
  db_name                   = "oficina_os"
  username                  = "oficina_os"
  password                  = random_password.db.result
  db_subnet_group_name      = aws_db_subnet_group.db.name
  vpc_security_group_ids    = [aws_security_group.db.id]
  publicly_accessible       = false
  backup_retention_period   = 7
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-final"
  deletion_protection       = true
}
resource "aws_secretsmanager_secret" "db" { name = "oficina/fase4/os/${var.environment}/database" }
resource "aws_secretsmanager_secret_version" "db" {
  secret_id     = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({ url = "postgresql://oficina_os:${random_password.db.result}@${aws_db_instance.db.address}:5432/oficina_os?sslmode=require" })
}
resource "aws_ecr_repository" "app" {
  name                 = "oficina-fase4-os"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
}
resource "aws_sqs_queue" "dlq" {
  name                      = "${local.name}-events-dlq.fifo"
  fifo_queue                = true
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}
resource "aws_sqs_queue" "events" {
  name                        = "${local.name}-events.fifo"
  fifo_queue                  = true
  content_based_deduplication = false
  visibility_timeout_seconds  = 90
  sqs_managed_sse_enabled     = true
  redrive_policy              = jsonencode({ deadLetterTargetArn = aws_sqs_queue.dlq.arn, maxReceiveCount = 3 })
}
output "database_secret_id" { value = aws_secretsmanager_secret.db.id }
output "ecr_repository_url" { value = aws_ecr_repository.app.repository_url }
output "os_queue_url" { value = aws_sqs_queue.events.url }
output "os_dlq_name" { value = aws_sqs_queue.dlq.name }
