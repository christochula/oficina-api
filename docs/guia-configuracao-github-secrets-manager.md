# Guia de Configuracao do Deploy com GitHub Actions, Terraform e Secrets Manager

Este guia resume, em ordem pratica, o que configurar para subir e depois recriar o ambiente sem deixar segredos em codigo.

## Objetivo

- Guardar senhas e tokens no AWS Secrets Manager;
- Deixar o GitHub Actions apenas com nomes de secrets e permissao de acesso na AWS.
- Usar Terraform para criar a infraestrutura e aplicar os manifestos Kubernetes.
- Publicar a imagem da aplicacao no ECR antes do deploy dos manifests.
- No AWS Academy, usar RDS como banco ativo e deixar Postgres dentro do Kubernetes apenas como opcao academica/local, para evitar dependencia de PVC/EBS CSI no cluster.
- Manter o state do Terraform em S3 para que o GitHub Actions consiga atualizar o ambiente ja existente em execucoes futuras.

## O que configurar no GitHub

No repositório do GitHub, acesse:

- `Settings`
- `Secrets and variables`
- `Actions`
- `New repository secret`

Crie estes secrets:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`
- `DB_PASSWORD_SECRET_NAME`
- `APP_K8S_SECRET_NAME`
- `CLUSTER_IAM_ROLE_NAME`
- `NODE_IAM_ROLE_NAME`
- `CLUSTER_ADMIN_ROLE_NAME`

Opcional:

- `AWS_ROLE_ARN` (somente se sua conta permitir OIDC com GitHub Actions)
- `POSTGRES_K8S_SECRET_NAME` (somente se `deploy_k8s_postgres=true`)

### Resumo para AWS Academy e Start Lab

No AWS Academy, configure estes itens como `Repository secrets` no GitHub Actions.

Atualize a cada `Start Lab`, porque mudam a cada sessao:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`

Normalmente ficam estaveis enquanto o lab usar a mesma conta/regiao:

- `AWS_REGION`
- `DB_PASSWORD_SECRET_NAME`
- `APP_K8S_SECRET_NAME`
- `CLUSTER_IAM_ROLE_NAME`
- `NODE_IAM_ROLE_NAME`
- `CLUSTER_ADMIN_ROLE_NAME`

Opcionais:

- `AWS_ROLE_ARN`: deixe vazio/removido no AWS Academy quando OIDC nao estiver habilitado.
- `POSTGRES_K8S_SECRET_NAME`: use somente se `deploy_k8s_postgres=true`. No fluxo recomendado para AWS Academy, nao precisa.

Se o AWS Academy iniciar uma conta diferente, os recursos antigos nao estarao disponiveis nessa nova conta. Nesse caso, recrie os secrets no AWS Secrets Manager e confirme os nomes das roles IAM.

O workflow cria automaticamente um bucket S3 para o state do Terraform com o padrao:

```text
oficina-api-tfstate-<aws-account-id>-<aws-region>
```

Nao e preciso criar variavel ou secret no GitHub para esse bucket. Ele fica na propria conta AWS do lab e permite que o Terraform continue gerenciando os recursos ja criados em novas execucoes do workflow.

### O que cada secret faz

- `AWS_REGION`: regiao da AWS, normalmente `us-east-1`.
- `AWS_ACCESS_KEY_ID`: access key temporaria da sessao AWS Academy.
- `AWS_SECRET_ACCESS_KEY`: secret key temporaria da sessao AWS Academy.
- `AWS_SESSION_TOKEN`: session token temporario da sessao AWS Academy.
- `DB_PASSWORD_SECRET_NAME`: nome do secret do RDS no AWS Secrets Manager.
- `APP_K8S_SECRET_NAME`: nome do secret da aplicacao no AWS Secrets Manager.
- `POSTGRES_K8S_SECRET_NAME`: nome do secret do Postgres no AWS Secrets Manager, usado apenas quando o Postgres tambem for aplicado dentro do Kubernetes.
- `CLUSTER_IAM_ROLE_NAME`: nome da role IAM preexistente do cluster EKS, se usar o Talent Lab.
- `NODE_IAM_ROLE_NAME`: nome da role IAM preexistente dos nodes EKS, se usar o Talent Lab.
- `CLUSTER_ADMIN_ROLE_NAME`: role que recebera permissao de admin no cluster EKS. No Talent Lab, normalmente `voclabs`.
- `AWS_ROLE_ARN` (opcional): role para OIDC. Se nao existir permissao de OIDC no lab, deixe vazio/removido para usar fallback por access key.

## O que criar no AWS Secrets Manager

Crie estes 2 secrets obrigatorios na AWS:

1. `oficina-api/dev/rds`
2. `oficina-api/dev/k8s/app`

Opcionalmente, crie tambem `oficina-api/dev/k8s/postgres` somente quando quiser aplicar o Postgres dentro do Kubernetes com `deploy_k8s_postgres=true`.

Esses secrets ficam no AWS Secrets Manager e nao precisam ser recriados a cada `Start Lab` se a conta AWS e os recursos do lab forem preservados. O workflow atualiza automaticamente a chave `DATABASE_URL` dentro de `oficina-api/dev/k8s/app` com o endpoint RDS vigente.

### Conteudo de cada secret

#### 1. `oficina-api/dev/rds`

Use um JSON com a chave:

Observacao: valor abaixo e somente exemplo ficticio.

```json
{
  "db_password": "EXEMPLO_SENHA_FORTE_123"
}
```

Regra importante do RDS: a senha nao pode conter `/`, `@`, `"` ou espaco.

#### 2. `oficina-api/dev/k8s/app`

Use um JSON com as chaves abaixo:

Observacao: valores abaixo sao somente exemplos ficticios.
No fluxo de CD, o valor de `DATABASE_URL` sera sobrescrito automaticamente com o endpoint RDS real apos o `terraform apply` da infraestrutura base. Mesmo assim, mantenha a chave preenchida para a validacao inicial do Secret Kubernetes.

```json
{
  "DATABASE_URL": "postgresql://oficina:EXEMPLO_SENHA_FORTE_123@postgres-service:5432/oficina_db",
  "JWT_SECRET": "troque-por-um-segredo-forte",
  "JWT_EXPIRATION": "15m",
  "JWT_REFRESH_SECRET": "troque-por-outro-segredo-forte",
  "JWT_REFRESH_EXPIRATION": "7d",
  "ADMIN_SEED_PASSWORD": "troque-a-senha-do-admin",
  "ORCAMENTO_WEBHOOK_TOKEN": "troque-o-token-do-webhook"
}
```

#### 3. `oficina-api/dev/k8s/postgres` opcional

Use um JSON com a chave:

Observacao: valor abaixo e somente exemplo ficticio.
Use somente se `deploy_k8s_postgres=true`. No caminho recomendado para AWS Academy, deixe `deploy_k8s_postgres=false` e use o RDS.

```json
{
  "POSTGRES_PASSWORD": "EXEMPLO_SENHA_FORTE_123"
}
```

## O que vai no Terraform

No arquivo `infra/terraform.tfvars` local, configure:

- `db_password = ""`
- `db_password_secret_name = "oficina-api/dev/rds"`
- `db_password_secret_key = "db_password"`
- `use_secrets_manager_for_k8s_secrets = true`
- `app_k8s_secret_name = "oficina-api/dev/k8s/app"`
- `deploy_k8s_postgres = false`
- `app_image = ""` localmente, ou deixe o `cd.yml` preencher automaticamente com a imagem ECR publicada
- `postgres_k8s_secret_name = "oficina-api/dev/k8s/postgres"` somente se `deploy_k8s_postgres=true`
- `cluster_iam_role_name = "<nome-da-role-do-cluster-no-talent-lab>"` se usar role preexistente
- `node_iam_role_name = "<nome-da-role-dos-nodes-no-talent-lab>"` se usar role preexistente
- `cluster_admin_role_name = "voclabs"` no Talent Lab, ou outra role que tenha acesso ao cluster

## Passo a passo para subir tudo

### 1. Validar a conta AWS

Confirme que a sessao AWS esta ativa:

```bash
aws sts get-caller-identity
```

### 2. Criar os secrets na AWS

Crie os 2 secrets obrigatorios no AWS Secrets Manager com os nomes e JSONs acima.
Crie o secret `oficina-api/dev/k8s/postgres` apenas se for usar `deploy_k8s_postgres=true`.

### 3. Configurar o GitHub

Adicione os secrets do GitHub listados acima no repositório.

No AWS Academy, use o modo fallback por credenciais temporarias:

- manter `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
- manter os secrets de nomes (`DB_PASSWORD_SECRET_NAME`, `APP_K8S_SECRET_NAME`, `CLUSTER_IAM_ROLE_NAME`, `NODE_IAM_ROLE_NAME`, `CLUSTER_ADMIN_ROLE_NAME`)
- manter `POSTGRES_K8S_SECRET_NAME` apenas quando `deploy_k8s_postgres=true`
- deixar `AWS_ROLE_ARN` vazio/removido quando OIDC nao estiver habilitado

### 4. Preparar o Terraform

Na pasta `infra`:

```bash
terraform init \
  -backend-config="bucket=oficina-api-tfstate-<aws-account-id>-<aws-region>" \
  -backend-config="key=oficina-api/prod/terraform.tfstate" \
  -backend-config="region=<aws-region>" \
  -backend-config="encrypt=true"
./scripts/patch-eks-talent-lab.sh
terraform validate
```

No workflow `cd.yml`, o bucket S3 de state e criado automaticamente antes do `terraform init`.

### 5. Subir a infraestrutura base

Primeiro suba a base sem os manifests Kubernetes:

```bash
terraform apply -auto-approve -input=false -no-color -var="apply_k8s_manifests=false" -var="deploy_k8s_postgres=false"
```

Se estiver usando o workflow `cd.yml`, ele sincroniza automaticamente a `DATABASE_URL` do secret da aplicacao com o endpoint RDS criado.
Se estiver fazendo o deploy manualmente, antes dos manifests atualize o secret `oficina-api/dev/k8s/app` no Secrets Manager para apontar `DATABASE_URL` para:

```text
postgresql://oficina:<senha>@<terraform output rds_endpoint>:<terraform output rds_port>/oficina_db
```

### 6. Garantir que o ECR exista

Se o repositório ECR tiver sido removido, recrie antes do push:

```bash
aws ecr create-repository --repository-name oficina-api --region us-east-1
```

### 7. Build e push da imagem

Build da imagem e push para o ECR com a tag `latest`.
No workflow `cd.yml`, o account ID e o registry ECR sao resolvidos automaticamente com `aws sts get-caller-identity`; nao mantenha account ID fixo para ambientes AWS Academy que possam mudar de conta.

### 8. Aplicar os manifests Kubernetes

Depois rode o deploy dos manifests:

```bash
terraform apply -auto-approve -input=false -no-color -var="apply_k8s_manifests=true" -var="deploy_k8s_postgres=false"
```

### 9. Validar o cluster

Verifique os recursos no namespace da aplicacao:

```bash
kubectl -n oficina-api get deploy,svc,hpa,pods,job
```

## O fluxo real de informacoes

1. O GitHub Actions inicia o pipeline.
2. Ele faz build e testes da aplicacao.
3. Ele autentica na AWS por OIDC ou por credenciais temporarias do AWS Academy.
4. Ele garante que o ECR exista.
5. Ele resolve o account ID atual, faz build e push da imagem Docker no ECR dessa conta.
6. Ele garante o bucket S3 do Terraform state.
7. Ele chama o Terraform com backend S3.
8. O Terraform cria ou atualiza a infraestrutura na AWS.
9. O Terraform le os segredos no AWS Secrets Manager.
10. O workflow sincroniza `DATABASE_URL` no secret da aplicacao com o endpoint RDS recem-criado.
11. O Terraform cria os Secrets do Kubernetes a partir desses valores.
12. O Terraform aplica os manifests.
13. O Job `oficina-api-migrate` roda `prisma migrate deploy`.
14. O EKS sobe os pods da aplicacao.
15. A aplicacao usa a imagem ECR publicada pelo proprio workflow, os segredos montados no cluster e o RDS como banco ativo.

Observacao do fluxo atual:

- o workflow tenta OIDC quando `AWS_ROLE_ARN` existe
- quando `AWS_ROLE_ARN` esta vazio, ele usa fallback com `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` e `AWS_SESSION_TOKEN`
- a imagem do Deployment e do Job de migration e passada ao Terraform por `TF_VAR_app_image`
- o state do Terraform fica no bucket S3 `oficina-api-tfstate-<account>-<region>`
- o Terraform aplica o `metrics-server` pelos manifests em `k8s/03-messaging`, antes do HPA
- o Terraform nao provisiona `aws-ebs-csi-driver` por padrao; por isso, no AWS Academy, mantenha `deploy_k8s_postgres=false` e use o RDS

## Adequacao ao AWS Academy

O fluxo e adequado para AWS Academy quando a conta da turma permite EKS, RDS, ECR, VPC, EC2, CloudWatch e Secrets Manager, e quando existem roles IAM compativeis para o cluster e para os nodes.

Pontos de atencao do AWS Academy:

- As credenciais sao temporarias. Atualize `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` e `AWS_SESSION_TOKEN` antes de rodar o workflow.
- OIDC com GitHub Actions normalmente nao fica disponivel no lab; deixe `AWS_ROLE_ARN` vazio para usar o fallback por credenciais temporarias.
- EKS pode ser bloqueado ou limitado dependendo da licenca/lab. Se o `terraform plan/apply` falhar por IAM, service quota ou permissao de EKS, use o plano alternativo EC2 + K3s documentado em `aws-student-lab-delivery-plan.md`.
- NAT Gateway, EKS e RDS consomem credito rapidamente. Destrua o ambiente depois da gravacao.
- O Postgres em Kubernetes exige StorageClass/PVC funcional. No caminho recomendado para AWS Academy, `deploy_k8s_postgres=false` evita esse ponto e usa o RDS.
- Se os recursos foram criados antes da configuracao do backend S3, o primeiro deploy automatico pode precisar de importacao do state ou de recriacao controlada. Depois que o state estiver no S3, as execucoes seguintes passam a ser incrementais.

## O que cada ferramenta faz

### AWS Secrets Manager

- Guarda os segredos reais.
- Evita que senhas fiquem no codigo ou no YAML.
- Atende a parte de seguranca e organizacao dos secrets.

### Terraform

- Cria a infraestrutura da AWS.
- Cria EKS, VPC, RDS e recursos de rede.
- Aplica os manifests Kubernetes.
- Le os segredos do Secrets Manager.
- No caminho AWS Academy, usa o RDS como banco ativo e aplica o Job de migrations antes da API.

### GitHub Actions

- Orquestra o pipeline.
- Faz build, testes, publish da imagem e chamada do Terraform.
- Automatiza o deploy.

## Checklist rapido para nao errar

- [ ] A sessao AWS esta valida.
- [ ] Os 2 secrets obrigatorios existem no AWS Secrets Manager.
- [ ] `POSTGRES_K8S_SECRET_NAME` so foi configurado se `deploy_k8s_postgres=true`.
- [ ] `db_password` e `DATABASE_URL` estao consistentes com o RDS.
- [ ] Se `deploy_k8s_postgres=true`, `POSTGRES_PASSWORD` tambem esta consistente.
- [ ] A senha do RDS nao contem `/`, `@`, `"` ou espaco.
- [ ] Os secrets do GitHub estao configurados.
- [ ] O ECR existe.
- [ ] O bucket S3 de state do Terraform existe ou o workflow tem permissao para cria-lo.
- [ ] O Terraform foi inicializado.
- [ ] O patch do Talent Lab foi aplicado.
- [ ] A base foi aplicada com `apply_k8s_manifests=false`.
- [ ] A imagem foi publicada no ECR.
- [ ] Os manifests foram aplicados com `apply_k8s_manifests=true`.
- [ ] O namespace `oficina-api` tem os recursos esperados.
- [ ] O Job `oficina-api-migrate` concluiu com sucesso.
- [ ] O HPA enxerga metricas pelo `metrics-server`.
- [ ] Se `deploy_k8s_postgres=true`, ha StorageClass/PVC funcional no cluster.

## Observacao importante

Os segredos nao ficam em texto puro no codigo, mas ainda podem aparecer no state do Terraform dependendo do recurso que os consome. Para o video e para o laboratorio, o fluxo acima atende bem. Para ambiente mais serio, o ideal e usar backend remoto protegido para o state e revisar politicas de acesso.

## Ordem mais segura para o dia do deploy

1. Criar os secrets no AWS Secrets Manager.
2. Configurar os secrets do GitHub.
3. Rodar Terraform base.
4. Fazer build e push da imagem no ECR.
5. Aplicar os manifests.
6. Validar com `kubectl`.
7. Se estiver tudo certo, gravar a demonstracao.

## Se quiser destruir depois

Quando terminar, pode remover tudo com:

```bash
terraform destroy -auto-approve -input=false -no-color -var="apply_k8s_manifests=true"
```

Se estiver usando o modo de Secrets Manager, mantenha `use_secrets_manager_for_k8s_secrets=false` na destruicao caso os secrets ainda nao estejam configurados no momento do destroy.
