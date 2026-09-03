# Destroy / Cleanup

Executar **após a gravação**. Ordem **inversa** do deploy. Nada de `terraform
destroy` sem confirmação.

## Ordem

| # | Alvo | Comando | Observações |
|---|---|---|---|
| 1 | Aplicação (Helm) | `helm uninstall oficina-api -n oficina` | Remove Deployment, Service (o ELB some junto), HPA, PDB, Job. |
| 2 | `oficina-auth-serverless` | `terraform -chdir=terraform destroy` (ou workflow) | API Gateway, 3 Lambdas + log groups, SQS/DLQ/SNS. VPC Link não existe. |
| 3 | `oficina-infra-database` | `terraform destroy` | RDS (`skip_final_snapshot=true`, sem deletion protection), SG, subnet group, secret (`recovery_window=0` → some na hora). |
| 4 | `oficina-infra-kubernetes` | `terraform -chdir=aws destroy` | EKS + node group + addons, ECR (`force_delete=true`), metrics-server/Datadog (Helm). |
| 5 | Secret JWT manual | `aws secretsmanager delete-secret --secret-id oficina/homolog/jwt --force-delete-without-recovery` | |
| 6 | Bucket de state (opcional) | manter entre sessões; apagar só no fim do projeto | `aws s3 rb s3://oficina-tc3-tfstate-519768589921 --force` |

## Depende de

- Passo 1 antes do 4 (senão o ELB fica órfão sem o cloud-provider).
- Passo 2/3 antes do 4 (SG do RDS e Lambdas usam a VPC default; sem dependência
  cruzada de recursos criados, mas mantenha a ordem).

## Pode travar o destroy

- **ECR com imagens** → `force_delete = true` já resolve.
- **ELB órfão** se pular o passo 1 → apagar manualmente no console (EC2 → Load Balancers).
- **ENIs** da Lambda/ELB podem segurar a subnet por alguns minutos (a VPC é a
  default, não destruímos ela).

## Conferir custo residual (console, região us-east-1)

- EC2 → **Load Balancers** (nenhum)
- EKS → **Clusters** (nenhum)
- EC2 → **Auto Scaling Groups** / **Instances** (nenhum)
- RDS → **Databases** / **Snapshots** (nenhum)
- ECR → **Repositories** (nenhum, ou só o vazio)
- **Encerrar o lab** no AWS Academy limpa a maior parte automaticamente.
