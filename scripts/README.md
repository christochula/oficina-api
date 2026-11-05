# Configuração de CI/CD Fase 4

`configure-repositories.mjs` define proteção de `main` nos seis repositórios com PR obrigatório, uma aprovação e nomes reais dos checks. Por padrão somente mostra ações, nomes de variables e nomes de secrets. Nunca mostra valores secretos. **Não foi executado contra o GitHub.**

```sh
node scripts/configure-repositories.mjs
node scripts/configure-repositories.mjs --config /caminho/fora-do-git/configuration.json
# Aplicação explícita: requer GH_TOKEN com Administration write ou gh auth login.
# Secrets usam GitHub CLI por stdin; forneça seus valores no ambiente, nunca na linha de comando.
node scripts/configure-repositories.mjs --config /caminho/fora-do-git/configuration.json --apply
```

Use `repository-configuration.example.json` como referência e substitua placeholders. Repositórios precisam existir e ter `main`. O script não cria repositórios nem faz push, merge ou deploy. Cada regra aplicada é lida de volta para verificar proteção; falhas param a execução e não são apresentadas como sucesso. Configurações de bancos/filas dependem dos outputs Terraform de cada serviço.

O script cria/seleciona o Environment **homolog** em cada repositório. `environmentSecretsFromEnv` usa `gh secret set --env homolog`; `environmentVariables` usa as variables desse Environment. `repositorySecretsFromEnv` e `repositoryVariables` configuram o nível do repositório. Valores secretos são lidos do ambiente local e enviados por stdin; o JSON só contém seus nomes.

| Onde configurar | Chaves |
|---|---|
| Repository Secret, nos quatro repos com código | `SONAR_TOKEN` |
| Repository Variables, nos quatro repos com código | `SONAR_PROJECT_KEY`, `SONAR_ORGANIZATION` |
| Repository Variables, apenas OS | `BILLING_CI_REF`, `PRODUCTION_CI_REF` (quando necessário) |
| Environment homolog Secrets, nos seis repos | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` |
| Environment homolog Variables, infraestrutura | `TF_STATE_BUCKET`, `VPC_ID`, `PRIVATE_SUBNET_IDS_JSON`, `EKS_NODE_SECURITY_GROUP_ID` |
| Environment homolog Variables, OS deploy | `OS_DATABASE_SECRET_ID`, `JWT_SECRET_ID`, `OS_RUNTIME_SECRET_ID`, `OS_QUEUE_URL`, `BILLING_QUEUE_URL`, `PRODUCTION_QUEUE_URL`, `BILLING_SERVICE_URL`, `PRODUCTION_SERVICE_URL` |
| Environment homolog Variables, Billing deploy | `DATABASE_SECRET_ID`, `JWT_SECRET_ID`, `BILLING_RUNTIME_SECRET_ID`, `BILLING_QUEUE_URL`, `OS_QUEUE_URL`, `MP_NOTIFICATION_URL`, `MP_BACK_URL` |

Os jobs de CI/Sonar não selecionam Environment e, portanto, precisam do `SONAR_TOKEN` **Repository Secret**. Os jobs de deploy/infra selecionam `environment: homolog` para receber as credenciais AWS e variables de runtime. Os valores de JWT, token interno e credenciais Mercado Pago continuam no **AWS Secrets Manager**, referenciados pelos IDs acima; não são GitHub Variables. Billing ECR: `oficina-homolog-billing`, igual ao recurso Terraform.

CI OS publica `Quality`, `Integration`, `Sonar`, `Frontend`, `BDD`, `Container`. `Integration` mantém `PHASE4_ENABLED=false` para a suíte herdada. BDD e Playwright executam processos reais usando `compose.phase4.yml` e clones irmãos Billing/Production; refs vêm de inputs manuais, variables `BILLING_CI_REF`/`PRODUCTION_CI_REF` ou `main`. Ajustar refs para as branches publicadas antes do primeiro CI distribuído.

Deploy usa somente o SHA de um CI concluído com sucesso em push na main. `check-deploy-gates.mjs` confere os seis checks do mesmo SHA antes de publicar imagem ECR imutável. `prepare-os-deploy-secrets.sh` lê Secrets Manager e cria Secret exclusivamente em `oficina-fase4`; credenciais temporárias do Learner Lab são injetadas no runtime e devem ser renovadas. Não há escrita no namespace legado `oficina`.

Workflow `OS Infrastructure` provisiona somente `infra/` com state `oficina-fase4/os/terraform.tfstate`. Push aprovado na main com alterações nessa infraestrutura aplica plano automaticamente; execução manual faz apenas plano por padrão. Primeiro provisionamento precede a configuração de URLs/secrets do deploy de aplicação.
