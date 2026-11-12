# Deploy da Fase 4 em outra conta AWS

Este procedimento cria uma base AWS independente para a Fase 4 e reutiliza as contas externas existentes de GitHub, Sonar, Mercado Pago e Datadog. A conta de destino deve ser identificada antes de qualquer acesso AWS. Não copiar o state de recursos AWS da conta antiga, nem substituir seus backends. A conta e os ARNs da Karina permanecem em branco no exemplo até serem confirmados.

O contrato de entradas, suas origens, destinos e etapas está em [deploy-manifest.example.json](../fase4/deploy-manifest.example.json). Ele contém somente metadados e nomes de secrets. **Não é entrada para `scripts/configure-repositories.mjs`**: esse script tem outro formato e pode escrever configurações no GitHub. O manifesto não executa deploy nem contém credenciais.

## Escopo e pré-requisitos

- Implantar `oficina-infra-kubernetes`, `oficina-api`, `oficina-billing-service`, `oficina-production-service` e `oficina-auth-serverless`.
- Não implantar `oficina-infra-database`: é o RDS legado da Fase 3. Não habilitar seu deploy automático ao preparar a Fase 4. A desativação do workflow legado, se necessária, é uma operação separada; este runbook não altera seu código.
- Manter GitHub owner, organização/projetos Sonar, organização Datadog e vendedor/aplicação Mercado Pago já usados. Apenas a infraestrutura AWS e seus identificadores serão novos.
- Revisar e publicar os commits necessários antes do deploy. Registrar um SHA completo por repo, com CI concluído para o mesmo HEAD; alterações locais ainda não estão na imagem publicada. Na API, `BILLING_CI_REF` e `PRODUCTION_CI_REF` devem corresponder às versões revisadas dos serviços.
- Confirmar Learner Lab versus conta comum, crédito disponível, duração da sessão, quotas para EKS/EC2/dois RDS e políticas que permitem o uso das roles existentes. Não criar IAM/OIDC ou ampliar permissões como parte deste procedimento.
- Confirmar VPC default, rotas, IPs disponíveis e suporte das subnets. O Terraform filtra pelos IDs físicos de AZ incompatíveis (`use1-az3`, `usw1-az2`, `cac1-az3`), não por letras de zonas que podem mudar entre contas.
- Escolher explicitamente um minor EKS em `STANDARD_SUPPORT`. A versão do exemplo de teste não substitui a consulta de compatibilidade na região de destino.
- O destino atual dos workflows é `us-east-1`, `homolog`, cluster `oficina-homolog-eks`, namespace `oficina-fase4`. Mudar região/nomes exige revisão de todos os contratos; não basta mudar o manifesto.

## Identidade e preflight de leitura

Copiar o exemplo para um caminho local ignorado, por exemplo `output/video-readiness/deploy/karina-manifest.local.json`. Preencher `scope.awsAccountId`, versão EKS e ARNs de roles com informações confirmadas. Deixar secrets fora desse arquivo. O bucket pode permanecer `null`: o preflight deriva `oficina-tc3-tfstate-<conta-confirmada>`.

Validação local, sem AWS/GitHub:

```powershell
node scripts/preflight-deploy-account.mjs --validate
node scripts/preflight-deploy-account.mjs --validate --manifest output/video-readiness/deploy/karina-manifest.local.json
node --test scripts/preflight-deploy-account.test.mjs
```

Somente após autorização para leitura da conta e configuração de uma sessão identificada, executar:

```powershell
node scripts/preflight-deploy-account.mjs --aws --profile karina-lab --manifest output/video-readiness/deploy/karina-manifest.local.json
```

O modo padrão é offline. `--aws` faz STS primeiro e interrompe se a conta não for exatamente a esperada. Depois consulta somente metadados: versão EKS, VPC/subnets, existência das roles, proteção/metadados do bucket e inventários de recursos. Não lê valores de Secrets Manager ou corpos de states; não cria kubeconfig; não chama GitHub, Datadog ou Mercado Pago. `403` significa acesso desconhecido/negado, nunca prova de ausência. Saída `2` indica pendências/revisão; saída `1`, falha de validação/identidade. Ausência do bucket em uma conta nova é esperada e exige bootstrap explícito posterior, não criação pelo preflight.

O preflight não comprova permissões de escrita, crédito, quotas, confiança completa das roles, rotas/Internet Gateway, acesso Kubernetes ou propriedade dos recursos Datadog. Esses itens precisam de inspeção específica. Roles existentes não provam que `iam:PassRole` e as permissões de serviço estão disponíveis. `PRINCIPAL_ARN` deve ser um ARN IAM permanente, não `arn:...:sts::...:assumed-role/...`.

Os workflows dos cinco repos ativos exigem `EXPECTED_AWS_ACCOUNT_ID` e conferem STS logo após `configure-aws-credentials@v4`, antes de acessar recursos. A plataforma também confere o proprietário esperado do bucket. A action v4 não oferece `allowed-account-ids`; a verificação explícita evita depender de um input ignorado.

Não usar `recover-nodes.yml`/`recover-empty-nodes.mjs` para bootstrap ou para a conta nova. Eles têm escopo operacional fixo de outra conta e devem continuar recusando a conta da Karina. Não remover essa proteção para reutilizá-los.

## Credenciais e secrets

Login no console não autentica automaticamente Actions ou pods. Uma sessão temporária usa o trio `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`. Atualizar o trio inteiro no Environment `homolog` dos cinco repos ativos, por canal seguro, sem colocá-lo no manifesto, logs, PRs ou chat.

### Receber a sessão temporária depois da preparação

Enquanto o acesso não chega, manter o manifesto local com conta/roles/versão ainda não confirmadas em `null`, os deploys suspensos e os PRs disponíveis para revisão. O comando abaixo descreve o contrato sem ler credenciais, escrever arquivos ou acessar AWS/GitHub:

```powershell
node scripts/prepare-isolated-aws-session.mjs --describe
```

Quando o titular do lab disponibilizar a sessão, salvar o bloco INI de **AWS Details** em um arquivo privado fora do workspace, sem colar seu conteúdo no terminal, no chat ou no repositório. O arquivo deve conter somente um perfil e o trio temporário completo. O helper confere proprietário/permissões e recusa acesso amplo ao arquivo; no Windows permite apenas o usuário atual, SYSTEM e administradores. Confirmar também o ID da conta, região, saldo e horário de expiração informado pelo lab. A expiração não pode ser deduzida apenas do token.

O exemplo usa uma pasta nova por sessão e preserva os perfis existentes, inclusive `default`. Ajustar somente os caminhos privados; os valores das credenciais não são argumentos de linha de comando:

```powershell
$sessaoKarina = Join-Path $env:USERPROFILE '.aws\oficina-karina-sessao-01'
$entradaKarina = Join-Path $env:USERPROFILE '.aws\incoming\karina-credentials.ini'
node scripts/prepare-isolated-aws-session.mjs --import-file $entradaKarina --directory $sessaoKarina
```

A importação é offline e não autentica a conta. Ela cria arquivos separados com o perfil `karina-lab`, sem sobrescrever pastas existentes. Depois de preencher `scope.awsAccountId` com a conta confirmada, executar a leitura usando os arquivos isolados:

```powershell
node scripts/prepare-isolated-aws-session.mjs --preflight --directory $sessaoKarina --manifest output/video-readiness/deploy/karina-manifest.local.json
```

Esse modo remove as configurações AWS herdadas do processo filho, desabilita fallback de metadata e reutiliza a verificação de identidade do preflight antes das demais consultas. As roles e a versão EKS ainda podem estar pendentes; o resultado será uma avaliação parcial, nunca autorização automática para provisionar. Nenhum desses comandos altera GitHub, cria recursos ou renova credenciais nos pods.

Após conferir a identidade, completar o manifesto com os metadados reais, verificar permissões/rede/quotas e atualizar as configurações e os três secrets temporários dos **cinco repos ativos**. Não usar `configure-repositories.mjs --apply` como importador de sessão: ele também altera proteções/configurações de repositórios e inclui o banco legado. Renovar o acesso repetindo a importação para uma pasta nova, sem publicar os arquivos privados. A remoção das cópias temporárias deve respeitar a política de guarda do titular do lab.

`aws login` pode usar autenticação pelo navegador com CLI >=2.32 e permissão `SignInLocalDevelopmentAccess`; a existência desse recurso não garante que o Lab o permita e não configura o runner/pods. O perfil local deve permanecer separado da conta anterior.

Os três serviços copiam as credenciais temporárias para Secrets Kubernetes. Quando a sessão expirar, renovar os secrets de GitHub e executar os deploys/rollouts de OS, Billing e Production para recarregar os processos. Renovar apenas a sessão do navegador não basta. Verificar novamente processamento SQS/DynamoDB depois da renovação. Lambdas usam sua execution role existente.

O manifesto distingue:

| Origem | Material | Destino |
|---|---|---|
| Sessão AWS nova | trio temporário | GitHub `homolog`, depois runtime Kubernetes |
| Contas externas existentes | `SONAR_TOKEN`; par MP; par Datadog | Escopos GitHub indicados em `bindings` |
| OS infra apply | JWT/refresh independentes, token interno canônico, senha inicial de administrador | Secrets Manager da conta nova |
| Terraform OS/Billing | senhas e URLs dos respectivos RDS | Secrets Manager; valores sensíveis também existem no state |
| Production infra/deploy | metadata do secret e cópias coerentes do JWT/token | Secret de aplicação Production |
| Billing bootstrap/final | token interno; depois par MP validado | Secret runtime Billing |
| Plataforma Datadog | cópia do mesmo par externo existente | `oficina/datadog` na AWS nova, Agent e instrumentação Auth |

Os helpers preservam valores válidos em novas tentativas e recusam inconsistências, rotação implícita e secrets em exclusão pendente. Não inventar JWTs separados entre serviços. Recuperar a senha inicial de administrador somente pelo canal seguro autorizado; não publicá-la junto das evidências.

## Backends independentes

O bucket novo tem criptografia, versionamento, bloqueio público e lockfile S3. Usar as keys dos Actions:

| Stack | Key |
|---|---|
| Plataforma AWS | `oficina/kubernetes/terraform.tfstate` |
| OS | `oficina-fase4/os/terraform.tfstate` |
| Billing | `oficina-fase4/billing/terraform.tfstate` |
| Production | `oficina/production/terraform.tfstate` |
| Auth | `oficina/auth/terraform.tfstate` |
| Datadog, somente proprietário canônico revisado | `oficina/observability/terraform.tfstate` |

Os exemplos de backend não contêm mais uma conta real. Nunca usar `terraform init -migrate-state` para transportar os recursos da conta antiga para a nova. Usar checkout/diretório de trabalho independente, sem reaproveitar `.terraform` ligado ao backend antigo. Não apagar, renomear, sobrescrever ou misturar os states existentes.

O exemplo antigo de observabilidade usava `oficina/homolog/observability.tfstate`. Se essa key existir, inventariar também a key canônica antes de qualquer plano; não iniciar um state vazio paralelo e não apagar o antigo para resolver o conflito. Não publicar state, plano binário ou JSON bruto de plano em artifacts.

## Sequência operacional e critérios de passagem

1. **CI e configuração:** preparar Environments/vars/secrets conforme `bindings`; validar permissões e SHAs. `DEPLOY_SOURCE_REF` é um fallback, não substitui `target_ref`/`target_sha` exatos. Manter os checkouts entre repos no owner existente.
2. **Plataforma base:** `DATADOG_ENABLED=false`, `DATADOG_OBSERVABILITY_MODE=agent-only`; configurar conta, roles, versão EKS. Solicitar `operation=plan`. Esse plan explícito pode criar/proteger o bucket de estado; portanto não é uma operação totalmente de leitura. PR plan não cria bucket. Revisar o artefato, definir `PLATFORM_APPROVED_PLAN_RUN_ID` e solicitar apply no mesmo SHA/ref. Exigir cluster ACTIVE, nodes Ready, DNS e metrics-server prontos.
3. **Infra OS:** usar VPC/subnets/SG dos outputs da plataforma, confirmar SG real dos nodes. Plan/revisão/`OS_APPROVED_PLAN_RUN_ID`/apply. O apply cria primeiro os secrets canônicos de runtime por helper, além de RDS, fila, DLQ e ECR por Terraform.
4. **Infra Billing e Production:** plan/apply com `BILLING_APPROVED_PLAN_RUN_ID` e `PRODUCTION_APPROVED_PLAN_RUN_ID`. Registrar outputs reais; as filas dos três serviços devem existir antes dos deploys. RDS são privados (`publicly_accessible=false`), mas a variável `PRIVATE_SUBNET_IDS_JSON` não transforma as subnets default em privadas.
5. **Production deploy:** consome tabela/fila/ECR/metadata de secret do próprio state, fila OS e secrets canônicos. Exigir rollout e health.
6. **Billing bootstrap:** usar o input explícito `bootstrap=true` ou o fluxo equivalente de tag bootstrap. Sobe sem credenciais MP para obter o LoadBalancer. Não inserir URLs ou tokens fictícios para passar validações. Bootstrap recusa um runtime que já tenha credenciais MP, impedindo downgrade silencioso.
7. **OS deploy:** configurar três filas, secrets e DNS internos Billing/Production. Build frontend com `/api/v1` e auth de cliente same-origin. Deploy executa migração/seed. Exigir rollout/health e registrar seu LoadBalancer.
8. **Auth/Gateway:** preencher `BACKEND_URL` OS, `BILLING_BACKEND_URL` com porta 3001, `PRODUCTION_BACKEND_URL` com porta 3002, ARNs novos dos secrets e `LAB_ROLE_ARN` da execution role. `OS_CLIENT_LOOKUP_URL` fica vazio para derivar o HTTPS do próprio Gateway. Plan/revisão/`AUTH_APPROVED_PLAN_RUN_ID`/apply; registrar `api_endpoint` e fila de notificações.
9. **Billing final:** `bootstrap=false`; `MP_NOTIFICATION_URL=<api_endpoint>/api/v1/billing/webhooks/mercadopago`, `MP_BACK_URL=<api_endpoint>`. Usar o mesmo vendedor/aplicação de teste existentes. O helper valida `/users/me`, `site_id=MLB`, `test_user` e o par persistido antes de gravar. Exigir checkout e retorno à mesma OS pelo novo HTTPS.
10. **OS final:** configurar origem HTTPS nova e `NOTIFICATION_QUEUE_URL` se notificações forem usadas; redeploy para atualizar runtime/build quando necessário. Não reutilizar Gateway antigo em CORS ou frontend. A existência de SNS não comprova assinatura ou entrega de notificações: confirmar o destinatário/canal de teste separado.
11. **Datadog Agent:** seguir a reconciliação abaixo, habilitar Agent e depois instrumentação Auth/OS. Preservar versões já instaladas dos add-ons ao fazer este segundo plano. Instalar Agent não comprova ingestão: verificar dados dos três serviços.
12. **Aceite remoto:** testar a jornada completa, recuperação de estoque e consumo, rejeição, pagamento recusado/aprovado, entrega, privacidade e retomada após reinício. Conferir contratos publicados, três serviços, filas/DLQs e correlação da mesma OS. Registrar URL nova, SHAs, imagens e resultados sem credenciais. Só então considerar limpeza do ambiente anterior em plano separado.

Cada apply exige o plano revisado do mesmo repo/SHA/ref/escopo; não reutilizar IDs de runs da conta antiga. Artefatos de plano expiram e mudanças de estado podem exigir novo plan. Não juntar vários applies sem verificar os outputs intermediários. `workflow_run` de `main` pode disparar deploys: preparar dependências/vars antes de ativar essa publicação.

## Datadog existente: um proprietário por recurso

Manter `DATADOG_OBSERVABILITY_MODE=agent-only` na plataforma da AWS nova. Esse modo instala/configura o Agent no novo cluster, mas **não inicializa, planeja nem aplica o stack `observability`**. Os dashboards, monitores, Synthetics e configurações globais continuam pertencendo ao state canônico existente. O valor padrão `manage` preserva o comportamento de ambientes já gerenciados; para nova conta, o valor explícito `agent-only` é obrigatório neste procedimento. Mudança de modo faz parte do escopo comparado entre plan e apply.

Antes de alterar recursos externos:

1. Identificar bucket/key, conta de backend, pipeline proprietário e IDs dos recursos Datadog existentes. Não obter essa informação criando recursos com nomes iguais.
2. Conferir as duas possíveis keys históricas e guardar evidência de ownership sem expor corpos de state. Não tornar dois states donos do mesmo dashboard/monitor.
3. Reconciliar pelo state canônico e suas credenciais de backend autorizadas. Atualizar o Synthetic para o Gateway novo somente nesse fluxo revisado. Se não houver acesso ao backend antigo, manter a reconciliação pendente; não contornar criando cópias.
4. Se for indispensável transferir ownership, preparar migração/importação específica de recursos Datadog, com backup, suspensão do proprietário anterior e revisão de plano sem duplicação. Isso é separado do bootstrap AWS e não implica migrar states de EKS/RDS da conta antiga. Preservar as versões históricas.

**Limite do modo agent-only:** ele não troca o endpoint do Synthetic antigo. Até a reconciliação confirmada, não afirmar que o monitor cobre a URL nova. Tags `env:homolog` e nome de cluster iguais podem agregar sinais dos dois ambientes durante a transição; confirmar host/conta/versão na evidência e encerrar a coleta antiga somente após o aceite.

## Custo, retenção e encerramento

O baseline inclui EKS, dois nodes `t3.medium`/50 GiB, dois RDS `db.t3.micro`, três LoadBalancers, IPv4, DynamoDB/PITR, filas, Secrets Manager, ECR, logs e armazenamento. Datadog e integrações têm custos próprios. O control plane EKS custa US$0,10/h em suporte padrão e US$0,60/h em estendido; isso não representa o total. Definir janela e orçamento antes do apply. Parar RDS mantém custo de armazenamento/backups e o banco reinicia automaticamente após sete dias. Não assumir que End Lab é teardown completo.

Após validar e preservar o vídeo, PDF e evidências, desmontar **somente os recursos da nova conta criados para esta entrega**, conforme a decisão do grupo. A conta antiga e seus states ficam fora desta operação. Confirmar a conta esperada e o inventário antes do plano de remoção. Interromper entradas, preservar as evidências e os backups necessários, remover Gateway/consumidores e workloads/Services enquanto o EKS ainda pode limpar os LoadBalancers. Depois remover recursos de aplicação, bancos e plataforma na ordem das dependências. OS/Billing têm proteção de exclusão e snapshot final obrigatório com nome fixo; resolver proteção e conflito de snapshot por mudança revisada. Conferir ECR não vazio, snapshots, secrets em janela de recuperação, versões S3 e outros resíduos cobrados; registrar o que foi removido e qualquer retenção necessária. Não excluir a organização ou recursos Datadog reutilizados; reconciliar o Synthetic para não monitorar um endpoint já desligado. O backend de state é o último recurso a encerrar, após concluir a remoção e preservar o registro operacional de forma privada; nunca publicar state bruto em artifacts, pois pode conter segredos.

## Preparação da versão para merge

A rodada de ensaio local foi encerrada pelo grupo em 12/11/2026. Preservar as evidências anteriores e publicar as correções posteriores como novos commits; não atribuir os resultados de um SHA anterior à nova versão. A jornada completa passa a ser requisito de homologação na AWS antes da gravação, sem uma nova rodada local como condição de merge.

Antes dos merges, exigir CI do HEAD atual, revisão de outro integrante e os checks definidos nas regras de `main`. Manter `BILLING_CI_REF` e `PRODUCTION_CI_REF` nos commits candidatos durante o CI da API. Consolidar os SHAs resultantes dos merges no manifesto antes de construir imagens ou gerar planos. CI ativo não autoriza reativar deploy automático na conta anterior.

## Referências e validação local

- [AWS: requisitos de rede EKS](https://docs.aws.amazon.com/eks/latest/userguide/network-reqs.html) e [IDs físicos de AZ entre contas](https://docs.aws.amazon.com/global-infrastructure/latest/regions/az-ids.html).
- [AWS: credenciais temporárias](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html) e [login CLI pelo navegador](https://docs.aws.amazon.com/signin/latest/userguide/command-line-sign-in.html).
- [AWS CLI: arquivos e perfis](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html) e [precedência das variáveis de ambiente](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html).
- [Preços EKS](https://aws.amazon.com/eks/pricing/) e [limites/custos de RDS parado](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html).
- [Contrato oficial da action AWS v4](https://raw.githubusercontent.com/aws-actions/configure-aws-credentials/v4/action.yml).

Os testes locais usam executores e providers simulados. Na plataforma, `terraform -chdir=aws test` verifica que `use1-az3` é excluída mesmo com outra letra, e que uma AZ chamada `us-east-1e` é aceita quando seu ID físico é suportado. `node --test scripts/*.test.mjs` cobre controles de plano e modo agent-only. Na API, a suíte do preflight verifica recusa de conta errada, ausência versus negação, states existentes, limites de leitura e ausência de vazamento de erros. A suíte `prepare-isolated-aws-session.test.mjs` testa importação privada com dados fictícios, recusa de sobrescrita/permissões amplas/configuração executável, isolamento de variáveis e interrupção após STS de conta errada. Nenhum desses testes confirma disponibilidade ou autorização na conta real.
