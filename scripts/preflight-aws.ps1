param([string]$Region = 'us-east-1', [string]$ClusterName = 'oficina-homolog-eks')
$ErrorActionPreference = 'Stop'
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw 'Instale/configure o AWS CLI e a sessão Academy antes do preflight. Não informe tokens no chat.'
}
$checks = @(
    @{ Name = 'Sessão AWS'; Args = @('sts','get-caller-identity','--query','Account','--output','text') },
    @{ Name = 'Cluster EKS'; Args = @('eks','describe-cluster','--name',$ClusterName,'--query','cluster.status','--output','text') },
    @{ Name = 'Acesso RDS'; Args = @('rds','describe-db-instances','--query','length(DBInstances)','--output','text') },
    @{ Name = 'Acesso DynamoDB'; Args = @('dynamodb','list-tables','--query','length(TableNames)','--output','text') },
    @{ Name = 'Acesso SQS'; Args = @('sqs','list-queues','--queue-name-prefix','oficina','--query','length(QueueUrls)','--output','text') },
    @{ Name = 'Acesso ECR'; Args = @('ecr','describe-repositories','--query','length(repositories)','--output','text') }
)
$failed = $false
foreach ($check in $checks) {
    $arguments = $check.Args + @('--region',$Region)
    & aws @arguments *> $null
    $ok = $LASTEXITCODE -eq 0
    [pscustomobject]@{ Check = $check.Name; Status = $(if ($ok) {'OK'} else {'VERIFICAR ACESSO/CONFIGURAÇÃO'}) }
    if (-not $ok) { $failed = $true }
}
Write-Output 'Confirme também crédito do Learner Lab, quotas para dois RDS novos e permissão dos pods para SQS/DynamoDB. Este script não cria recursos nem lê os valores dos secrets.'
if ($failed) { exit 1 }
