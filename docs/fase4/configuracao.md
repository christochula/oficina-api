# Configuração da Fase 4

Os arquivos `.env` e `terraform.tfvars` locais não são versionados. Copie os respectivos exemplos e substitua os valores de demonstração. Não coloque tokens privados em variáveis `VITE_*`: elas entram no JavaScript do navegador.

## Desenvolvimento e demonstração local

As três pastas devem estar no mesmo diretório: `oficina-api`, `oficina-billing-service` e `oficina-production-service`.

```powershell
cd oficina-api
npm ci
npm ci --prefix frontend
docker compose -f compose.phase4.yml up -d --build
npm run test:bdd
npx playwright install chromium
npm run test:frontend:e2e
```

O Compose usa dois PostgreSQL, LocalStack com DynamoDB/SQS e um simulador HTTP do Mercado Pago. Somente nesse ambiente os segredos e senhas locais do arquivo Compose são usados. Os bancos são separados e os serviços usam somente suas conexões.

O BDD cria dados fictícios pelas APIs dos serviços responsáveis. São Paulo (`filial-sp`) e Rio de Janeiro (`filial-rj`) têm estoques independentes. O [roteiro de teste pelo navegador](teste-navegador-local.md) prepara os acessos fictícios e habilita login por CPF pelo adaptador de desenvolvimento, que consulta o cadastro real do OS. O checkout local é simulado e preserva seus dados após reinícios. Na AWS, o login por CPF usa a Lambda e o checkout consulta o Mercado Pago com as credenciais da conta vendedora de teste verificada. As credenciais locais de demonstração não são usadas no deploy.

## Onde preencher cada segredo

| Serviço | Local | Chave/conteúdo |
|---|---|---|
| AWS local | Perfil do AWS CLI ou variáveis da sessão PowerShell | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION` |
| AWS CI | GitHub de cada repo: Settings → Environments → homolog → Secrets | As três credenciais temporárias AWS; renovar quando a sessão Academy expirar |
| OS local | `oficina-api/.env`, a partir de `.env.example` | `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_SEED_PASSWORD`, `AUTH_CLIENT_LOOKUP_TOKEN` |
| Billing local | `oficina-billing-service/.env` | `DATABASE_URL`, `JWT_SECRET`, `AUTH_CLIENT_LOOKUP_TOKEN`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` |
| Production local | `oficina-production-service/.env` | `JWT_SECRET`, `AUTH_CLIENT_LOOKUP_TOKEN`, configurações AWS/DynamoDB/SQS |
| Frontend | `oficina-api/frontend/.env.local` | `VITE_API_BASE_URL=/api/v1`; proxies de desenvolvimento dos serviços |
| JWT AWS | Secrets Manager: `oficina/fase4/jwt` | JSON `{"secret":"chave de acesso com pelo menos 32 bytes","refreshSecret":"outra chave exclusiva do OS"}` |
| Consulta interna AWS | Secrets Manager: `oficina/fase4/auth-client-lookup` | JSON `{"token":"valor aleatório com pelo menos 32 bytes"}`; o mesmo valor vira `AUTH_CLIENT_LOOKUP_TOKEN` dos backends |
| Auth Lambda | GitHub Variables / Terraform | `JWT_SECRET_ARN`, `AUTH_CLIENT_LOOKUP_SECRET_ARN`; `OS_CLIENT_LOOKUP_URL` opcional, derivado do Gateway quando omitido |
| Mercado Pago AWS | Secrets Manager: `oficina/homolog/billing/runtime` | `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`, acrescentados pelo deploy final ao token interno criado no bootstrap |
| Datadog | Secrets Manager canônico: `oficina/datadog` | Secrets `DATADOG_API_KEY`/`DATADOG_APP_KEY` no Environment `homolog` de infra-kubernetes; bootstrap e sincronização por [GitHub Actions](https://github.com/christochula/oficina-infra-kubernetes/blob/feature/phase4-distributed/docs/datadog-actions.md), com `DATADOG_SECRET_ID=oficina/datadog`. Não criar/rotacionar manualmente nem colocar chaves em `TF_VAR`/state |
| SonarQube Cloud | GitHub Secret `SONAR_TOKEN`, Variables por repositório | `SONAR_PROJECT_KEY`, `SONAR_ORGANIZATION` |

Os pipelines dos serviços documentam seus nomes exatos de secret: `DATABASE_SECRET_ID` contém JSON `{ "url": "postgresql://..." }`, `JWT_SECRET_ID` contém o contrato acima, e o Secret de runtime contém o token interno e, no Billing, as configurações Mercado Pago. RDS gera as senhas e URLs no Terraform; não é necessário copiar uma senha de outro serviço.

Ingestão Datadog dos três serviços verificada em 11/11/2026 00:17:54 UTC (10/11 21:17:54 em São Paulo), seguida do ensaio completo da OS #2 com sinais Saga/p95 e um trace com spans dos três serviços para parte do fluxo. O [registro sanitizado de resultados](../operacao/datadog.md#evidência-verificada) distingue esses sinais da indexação de todas as transições de uma Saga.

## AWS e ordem de provisionamento

Para outra conta AWS, seguir o [runbook de nova conta](../operacao/deploy-fase4-nova-conta.md) e seu [manifesto sem segredos](deploy-manifest.example.json). Ele detalha os guards de conta, secrets gerados automaticamente, Billing bootstrap antes do Gateway, Billing final depois do HTTPS e Datadog agent-only sem duplicar o state externo. O RDS legado nao participa desse fluxo.

1. Validar conta/sessão, crédito, quotas e permissões de RDS, EKS, ECR, DynamoDB, SQS e Secrets Manager. O script `scripts/preflight-aws.ps1` executa apenas consultas de acesso. Na Academy, reutilizar `LabRole` e testar SDK dentro do pod; não pressupor criação de roles ou IRSA.
2. Preparar os secrets e os projetos Sonar. Preencher GitHub Environment `homolog` em todos os repositórios.
3. Provisionar cluster/Datadog compartilhados. Não reaplicar o state da Fase 3 como se fosse o state de banco de um novo serviço.
4. Provisionar `infra/` de cada serviço com `backend.hcl` e `terraform.tfvars` próprios. Copiar os outputs de URLs/ARNs para GitHub Variables dos respectivos consumidores. O OS usa `BILLING_QUEUE_URL` e `PRODUCTION_QUEUE_URL`; todos publicam eventos para a inbox do OS.
5. Fazer deploy no namespace novo `oficina-fase4`. Informar os nomes reais de Service Kubernetes em `BILLING_SERVICE_URL` e `PRODUCTION_SERVICE_URL` do OS.
6. Provisionar/atualizar auth/Gateway com as URLs externas dos três backends. Usar o endpoint HTTPS do Gateway no frontend, lookup de cliente e configurações Mercado Pago.
7. No Mercado Pago, configurar contas de teste, evento de pagamento, URL `/api/v1/billing/webhooks/mercadopago` e segredo de assinatura. Definir `MP_NOTIFICATION_URL` e `MP_BACK_URL` HTTPS; este último deve retornar ao portal com o identificador da OS preservado.
8. Validar os três Swagger, smoke tests, trace distribuído e fluxo real em contas de teste. Capturar os links do CI/Sonar/Datadog no README.

Terraform de aplicação: `terraform init -backend-config=backend.hcl`, `terraform plan`, revisar e aplicar pelo pipeline. Não são executados deploys reais sem os acessos preenchidos. A proteção da `main` deve exigir PR e os checks publicados pelos workflows; arquivos `.github/settings.yml` sozinhos não aplicam proteção.
