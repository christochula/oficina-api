# AWS Student Trial LAB Delivery Plan - Tech Challenge Fase 2

Data: 2026-07-01

Este plano parte do escopo descrito em `tech-challenge.md` e do estado atual deste repositorio `oficina-api/`. O objetivo e entregar o Tech Challenge hospedado em um ambiente AWS Student Trial/LAB, com Kubernetes, banco PostgreSQL, Terraform, CI/CD, APIs demonstraveis e evidencia de HPA.

## 1. Estado atual do repositorio

O projeto principal e este repositorio `oficina-api/`.

Stack encontrada:

- Backend NestJS 11, Node 20, TypeScript.
- PostgreSQL 16 com Prisma 5.
- Arquitetura em modulos com camadas `domain`, `application`, `infrastructure` e `interfaces`.
- Testes unitarios e e2e em Jest/Testcontainers.
- Swagger em `/api/docs` e Postman em `postman/`.
- Dockerfile multi-stage e `docker-compose.yml`.
- Manifestos Kubernetes em `k8s/`: Namespace, ConfigMap, Secret, Deployment, Service, HPA e Kustomization.
- Terraform em `infra/`: VPC, EKS e RDS.
- GitHub Actions em `.github/workflows/ci.yml` e `.github/workflows/cd.yml`.

Pontos fortes ja alinhados ao desafio:

- APIs obrigatorias de OS ja existem:
  - abertura de OS: `POST /api/v1/ordens-servico`
  - consulta publica de status: `GET /api/v1/ordens-servico/publico/status/:numero/:numeroDoc`
  - aprovacao/rejeicao externa por webhook: `POST /api/v1/ordens-servico/webhook/orcamento`
  - listagem priorizada de OS abertas/relevantes: `GET /api/v1/ordens-servico`
- A listagem prioriza `EM_EXECUCAO`, `AGUARDANDO_APROVACAO`, `EM_DIAGNOSTICO`, `RECEBIDA` e exclui logicamente status finais porque consulta apenas os status priorizados.
- A arquitetura ja esta documentada no `README.md`, `decisoes-arquiteturais-oficina.md`, `dicionario-ubiquo.md` e `fluxos-negocio-oficina.md`.

Gaps praticos para entrega em AWS LAB:

- Resolvido no checkout atual: o `cd.yml` resolve o account ID atual, publica no ECR dessa conta e passa a imagem ao Terraform por `app_image`.
- O Terraform atual usa EKS + NAT Gateway + RDS. Isso e mais caro e pode ser bloqueado no LAB por permissao/IAM. Para Student LAB, a rota mais segura e EC2 + K3s + RDS, mantendo EKS como alternativa.
- O `Service` atual e `ClusterIP`, portanto nao expoe a API publicamente no LAB. Precisamos de Ingress/Traefik, NodePort ou LoadBalancer do K3s.
- Resolvido no checkout atual: o Dockerfile inicia apenas a API; migrations rodam no servico `migrate` do Compose e no Job `k8s/03-migrations/migrate-job.yaml`.
- O HPA existe, mas precisa de metrics-server, carga simulada e evidencia gravada para o video.
- Nao ha `node_modules` local no workspace atual. Antes de qualquer afirmacao final de qualidade, rodar `npm ci`, build e testes.

## 2. Decisao de arquitetura AWS para o LAB

### Topologia recomendada para Student LAB

Usar uma arquitetura simples, barata e demonstravel:

- 1 EC2 Ubuntu `t3.medium` ou `t3.large` em subnet publica.
- K3s single-node instalado por Terraform `user_data`.
- PostgreSQL em Amazon RDS `db.t4g.micro` ou `db.t3.micro`, Single-AZ, se o LAB permitir RDS.
- Fallback se RDS estiver bloqueado: PostgreSQL como `StatefulSet` no K3s com PersistentVolume local, documentando que RDS e o alvo preferencial.
- Imagem Docker em GHCR publica ou Docker Hub para evitar complexidade de IAM/ECR no LAB.
- API exposta por Ingress do K3s/Traefik na porta 80 ou por NodePort com security group restrito.
- HPA escalando replicas da API no mesmo node. Isso demonstra escalabilidade horizontal de pods, mesmo sem autoscaling de nodes.

Justificativa:

- O desafio exige Kubernetes, Terraform, banco e HPA. Ele nao exige EKS especificamente.
- A AWS cobra uma taxa por cluster EKS alem dos recursos EC2/EBS/IP usados pelos nodes. Isso pode consumir creditos do LAB rapidamente.
- K3s e uma distribuicao Kubernetes leve, adequada para desenvolvimento, CI e ambientes pequenos.
- EC2 fornece capacidade computacional escalavel sob demanda e e mais previsivel para um LAB estudantil.
- RDS e preferivel para banco por ser servico gerenciado; se bloqueado, o fallback em Kubernetes ainda entrega o requisito de banco provisionado/documentado.

### Alternativa se o LAB permitir EKS

Manter a pasta `infra/` atual como caminho alternativo EKS + RDS, mas:

- Remover ou justificar NAT Gateway, porque ele adiciona custo.
- Reduzir node group para `min_size = 1`, `desired_size = 1`, `max_size = 2`.
- Conferir permissoes para criar IAM roles, EKS, node groups, RDS, VPC e CloudWatch.
- Medir custo antes de manter o cluster ligado.

## 3. Estrutura alvo do repositorio

Criar/adaptar os seguintes arquivos para a entrega AWS LAB:

```text
oficina-api/
  infra/
    aws-lab/
      providers.tf
      variables.tf
      main.tf
      outputs.tf
      user_data_k3s.sh
      README.md
    eks/
      ... opcional: mover a versao EKS atual para ca
  k8s/
    namespace.yaml
    configmap.yaml
    secret.example.yaml
    deployment.yaml
    service.yaml
    ingress.yaml
    hpa.yaml
    03-migrations/migrate-job.yaml
    job-seed-admin.yaml
    kustomization.yaml
    overlays/
      hpa-demo/
        kustomization.yaml
        hpa-patch.yaml
        deployment-resources-patch.yaml
  .github/
    workflows/
      ci.yml
      cd-lab.yml
```

Manter `secret.example.yaml` versionado e criar o Secret real apenas no cluster, sem commitar senhas reais.

## 4. Plano passo a passo

### Passo 1 - Baseline local do projeto

Objetivo: provar que o codigo atual compila, testa e sobe antes de mexer em AWS.

Comandos:

```bash
cd oficina-api
npm ci
npm run build
npm test -- --runInBand
npm run test:cov -- --runInBand
docker compose up --build -d
npm run test:e2e -- --runInBand
docker compose ps
```

Saidas esperadas:

- Build passando.
- Testes unitarios passando.
- Cobertura global dentro do threshold de 80%.
- E2E passando com PostgreSQL real.
- Swagger acessivel em `http://localhost:3000/api/docs`.

Se falhar:

- Corrigir primeiro testes/build.
- Registrar evidencias no README ou em `guia-teste-end-to-end.md`.

### Passo 2 - Fechar aderencia das APIs obrigatorias

Objetivo: garantir que o video e a avaliacao mostrem exatamente o que o enunciado pede.

Validar e documentar:

- Abertura de OS recebe cliente, veiculo, servicos e pecas ou referencias equivalentes ja cadastradas.
- Retorno da abertura inclui identificador unico da OS.
- Consulta de status retorna uma visao clara dos status do enunciado:
  - `Recebida` = `RECEBIDA`
  - `Diagnostico` = `EM_DIAGNOSTICO`
  - `Aguardando Aprovacao` = `AGUARDANDO_APROVACAO`
  - `Execucao` = `EM_EXECUCAO`
  - `Finalizada` = `FINALIZADA`
  - `Entregue` = `ENTREGUE`
- Webhook externo aceita aprovacao e recusa de orcamento com `x-webhook-token`.
- Listagem padrao mostra somente OS ativas/relevantes e na ordem exigida.

Entregaveis:

- Atualizar Swagger descricoes se necessario.
- Atualizar Postman collection com um fluxo completo.
- Adicionar no README uma tabela "Requisito do enunciado x endpoint".

### Passo 3 - Ajustar container e migracoes

Objetivo: deixar a imagem pronta para multiplas replicas em Kubernetes.

Alteracoes recomendadas:

- Confirmar que o `CMD` do Dockerfile inicia apenas a API.
- Usar `k8s/03-migrations/migrate-job.yaml` com a mesma imagem da API para executar:

```bash
npx prisma migrate deploy
```

- Criar `k8s/job-seed-admin.yaml` opcional para executar:

```bash
node dist/prisma/seed.js
```

- Manter o container da API iniciando apenas:

```bash
node dist/src/main
```

- Adicionar endpoint simples de health, por exemplo `GET /api/health`, e trocar probes TCP por HTTP.

Saida esperada:

- Build Docker local funcionando.
- Migrations rodando uma vez por Job.
- API pronta para 2+ replicas sem corrida de migracao.

### Passo 4 - Escolher e alinhar registry de imagem

Objetivo: manter imagem publicada e imagem aplicada no cluster sempre alinhadas.

Caminho atual do checkout:

- O `cd.yml` usa `aws sts get-caller-identity` para montar o registry ECR da conta ativa.
- A imagem e publicada com tag `sha-${GITHUB_SHA}` e `latest`.
- O Terraform recebe a imagem imutavel por `TF_VAR_app_image` e aplica no Deployment e no Job de migration.

Opcao alternativa se ECR/IAM for bloqueado no LAB:

- Usar GHCR publico ou Docker Hub.
- Nesse caso, ajustar `app_image` no Terraform/CD para o registry escolhido.

Comandos de validacao:

```bash
docker build -t oficina-api:lab-test .
docker run --rm -p 3000:3000 --env-file .env oficina-api:lab-test
```

### Passo 5 - Criar Terraform especifico para AWS Student LAB

Objetivo: provisionar infraestrutura que o LAB aguenta.

Criar `infra/aws-lab/` com:

- VPC simples ou default VPC documentada.
- Subnet publica para EC2.
- Duas subnets privadas para RDS, se RDS for usado.
- Internet Gateway e route table publica.
- Security Group da API:
  - inbound 22 somente do IP do grupo ou temporariamente no LAB.
  - inbound 80 para demo.
  - inbound NodePort se a exposicao escolhida for NodePort.
  - outbound liberado para instalar K3s e baixar imagens.
- Security Group do RDS:
  - inbound 5432 somente a partir do Security Group da EC2.
- EC2 Ubuntu com `user_data_k3s.sh`.
- RDS PostgreSQL Single-AZ micro, se permitido.
- Outputs:
  - `api_public_ip`
  - `api_base_url`
  - `ssh_command`
  - `rds_endpoint`
  - `database_url_template`
  - `kubeconfig_command`

Evitar no LAB:

- NAT Gateway, exceto se o professor exigir subnets privadas com saida.
- EKS como caminho principal, por custo/permissao.
- Load Balancer gerenciado se os creditos forem curtos.

Comandos:

```bash
cd oficina-api/infra/aws-lab
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform validate
terraform plan
terraform apply
```

Saida esperada:

- EC2 criada e acessivel.
- K3s instalado.
- `kubectl get nodes` funcionando na EC2.
- RDS criado ou fallback PostgreSQL documentado.

### Passo 6 - Instalar e validar Kubernetes no EC2/K3s

Objetivo: provar que o cluster existe e aceita manifests.

No EC2:

```bash
sudo kubectl get nodes
sudo kubectl get pods -A
```

Instalar metrics-server se ele nao vier no K3s:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl get apiservice v1beta1.metrics.k8s.io
kubectl top nodes
```

Saida esperada:

- Node `Ready`.
- CoreDNS/Traefik/metrics-server saudaveis.
- `kubectl top nodes` retorna CPU/memoria.

### Passo 7 - Preparar Secrets e ConfigMap do ambiente AWS

Objetivo: parametrizar a API sem commitar segredo real.

Criar Secret real no cluster:

```bash
kubectl create namespace oficina-api
kubectl create secret generic oficina-api-secret \
  -n oficina-api \
  --from-literal=DATABASE_URL='postgresql://oficina:<senha>@<rds-endpoint>:5432/oficina_db' \
  --from-literal=JWT_SECRET='<jwt-secret>' \
  --from-literal=JWT_EXPIRATION='15m' \
  --from-literal=JWT_REFRESH_SECRET='<jwt-refresh-secret>' \
  --from-literal=JWT_REFRESH_EXPIRATION='7d' \
  --from-literal=ADMIN_SEED_PASSWORD='<senha-admin-demo>' \
  --from-literal=ORCAMENTO_WEBHOOK_TOKEN='<token-webhook-demo>'
```

ConfigMap:

- `NODE_ENV=production`
- `PORT=3000`
- `CORS_ORIGIN=*` se nao houver frontend, ou a URL real se existir frontend.

Saida esperada:

- `kubectl describe secret oficina-api-secret -n oficina-api` mostra as chaves esperadas, sem expor valores.

### Passo 8 - Aplicar manifests Kubernetes

Objetivo: subir banco/migracao/API/servico/HPA no cluster.

Fluxo:

```bash
cd oficina-api
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/03-migrations/migrate-job.yaml
kubectl wait --for=condition=complete job/oficina-api-migrate -n oficina-api --timeout=180s
kubectl apply -k k8s
kubectl rollout status deployment/oficina-api -n oficina-api --timeout=180s
kubectl get pods,svc,hpa -n oficina-api
```

Se usar seed admin:

```bash
kubectl apply -f k8s/job-seed-admin.yaml
kubectl wait --for=condition=complete job/oficina-api-seed-admin -n oficina-api --timeout=180s
```

Saida esperada:

- Pods `Running`.
- Deployment `Available`.
- Service/Ingress com endpoint acessivel.
- Swagger publico em `http://<public-ip>/api/docs` ou endpoint equivalente.

### Passo 9 - Configurar exposicao publica para demo

Objetivo: permitir que o avaliador veja a API rodando no LAB.

Preferencia:

- Usar Ingress do K3s/Traefik:
  - abrir porta 80 no Security Group.
  - criar `k8s/ingress.yaml` roteando `/` para `oficina-api-service:80`.

Alternativa:

- Usar Service `NodePort`, por exemplo 30080:
  - abrir 30080 no Security Group.
  - acessar `http://<ec2-public-ip>:30080/api/docs`.

Validacao:

```bash
curl http://<endpoint>/api
curl http://<endpoint>/api/docs
```

### Passo 10 - Ajustar CI/CD para o LAB

Objetivo: a pipeline precisa demonstrar build, testes, imagem, deploy e aplicacao de manifests.

Manter `ci.yml`:

- `npm ci`
- `npm run build`
- `npm test -- --runInBand`

Criar ou adaptar `cd-lab.yml`:

- Gatilho `workflow_dispatch` e push em `main`.
- Build e push da imagem em GHCR.
- Deploy via SSH no EC2:
  - atualizar imagem do deployment.
  - aplicar Job de migration.
  - aplicar manifests.
  - aguardar rollout.

Secrets GitHub para o caminho SSH:

- `LAB_EC2_HOST`
- `LAB_EC2_USER`
- `LAB_EC2_SSH_KEY`
- `GHCR_TOKEN` se imagem privada, ou usar `GITHUB_TOKEN` se permitido.

Opcional, se o LAB permitir credenciais AWS em Actions:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`
- `AWS_REGION`
- `TF_VAR_db_password`

Importante:

- Em AWS Student LAB as credenciais podem ser temporarias. Se o workflow usar AWS direto, atualizar `AWS_SESSION_TOKEN` antes da demonstracao.
- Para ficar robusto, deixar Terraform rodando manualmente no LAB/CloudShell e usar a pipeline para build/test/image/deploy no cluster ja criado.

Saida esperada:

- Print ou link do GitHub Actions mostrando CI verde.
- Print ou link do CD mostrando imagem publicada e rollout no K3s.

### Passo 11 - Demonstrar HPA

Objetivo: gerar evidencia de escalabilidade automatica.

Preparar overlay de demo:

- `minReplicas: 1`
- `maxReplicas: 4`
- CPU target temporario menor, por exemplo 20%.
- CPU request menor, por exemplo `50m`, para disparar escala com carga leve.

Aplicar overlay:

```bash
kubectl apply -k k8s/overlays/hpa-demo
kubectl get hpa -n oficina-api
```

Gerar carga de dentro do cluster:

```bash
kubectl run load-generator \
  -n oficina-api \
  --rm -it \
  --image=rakyll/hey \
  -- -z 3m -c 80 http://oficina-api-service/api
```

Observar:

```bash
kubectl get hpa -n oficina-api -w
kubectl get pods -n oficina-api -w
kubectl top pods -n oficina-api
```

Evidencias para video:

- Antes: 1 replica.
- Durante carga: HPA aumentando replicas.
- Depois: estabilizacao ou scale down.
- Explicar que em LAB single-node o HPA escala pods; node autoscaling nao e o objetivo.

### Passo 12 - Roteiro de demonstracao das APIs

Objetivo: video de ate 15 minutos com fluxo objetivo.

Roteiro sugerido:

1. Mostrar README e arquitetura.
2. Mostrar CI verde no GitHub Actions.
3. Mostrar Terraform apply ou outputs do ambiente criado.
4. Mostrar `kubectl get pods,svc,hpa -n oficina-api`.
5. Abrir Swagger no endpoint publico do LAB.
6. Fazer login com admin seed.
7. Criar cliente, veiculo, servico e peca, ou usar collection Postman pronta.
8. Abrir OS e mostrar ID/numero retornado.
9. Consultar status publico da OS.
10. Avancar fluxo: atribuir mecanico, diagnostico, gerar orcamento.
11. Enviar webhook externo de aprovacao/recusa com `x-webhook-token`.
12. Listar OS e mostrar ordenacao por status.
13. Rodar carga e mostrar HPA escalando.
14. Mostrar link da collection Swagger/Postman.

### Passo 13 - Atualizar documentacao final

Objetivo: deixar o repositorio autocontido para avaliacao.

Atualizar `oficina-api/README.md` com:

- Descricao da solucao da Fase 2.
- Objetivos da fase.
- Arquitetura proposta em Mermaid ou imagem:
  - GitHub Actions
  - GHCR/ECR
  - EC2
  - K3s
  - Pods da API
  - HPA
  - RDS/PostgreSQL
  - Swagger/Postman
- Execucao local.
- Deploy AWS LAB com Terraform.
- Deploy Kubernetes.
- Como rodar migrations/seed.
- Como demonstrar HPA.
- Link Swagger ou Postman.
- Link do video.

Atualizar `infra/aws-lab/README.md` com:

- Pre-requisitos.
- Servicos AWS usados.
- Variaveis.
- Comandos `init`, `validate`, `plan`, `apply`, `destroy`.
- Troubleshooting de permissao do LAB.
- Estimativa qualitativa de custo e lembrete de destruir recursos.

Criar `ENTREGA.md` ou secao final no README com:

- Link do repositorio GitHub.
- Confirmacao de compartilhamento com `soat-architecture`.
- Link do video.
- URL publica temporaria da API no LAB.
- Observacao sobre destruicao do LAB apos gravacao.

### Passo 14 - Preparar PDF final para o portal

Objetivo: entregar exatamente o que o portal pede.

PDF deve conter:

- Link do GitHub.
- Confirmacao de acesso ao usuario `soat-architecture`.
- Desenho da arquitetura AWS LAB.
- Link do video de ate 15 minutos.
- Link da API/Swagger, se ainda estiver ativa.
- Observacao: ambiente em AWS Student LAB pode ser desligado apos a avaliacao por custo/credito.

## 5. Ordem de execucao recomendada

1. Rodar baseline local completo.
2. Corrigir qualquer falha de build/test.
3. Feito: alinhar imagem do workflow com Deployment/Job via `TF_VAR_app_image`.
4. Criar `infra/aws-lab/` EC2 + K3s + RDS/fallback.
5. Feito: adicionar `k8s/03-migrations/migrate-job.yaml`; pendente opcional: `job-seed-admin.yaml`, `ingress.yaml` e `secret.example.yaml`.
6. Feito: ajustar Dockerfile para nao migrar no start do pod.
7. Criar endpoint `/api/health` e atualizar probes.
8. Fazer deploy manual no LAB via Terraform + kubectl.
9. Ajustar `cd-lab.yml` para redeploy por SSH.
10. Rodar Postman/Swagger contra endpoint publico.
11. Preparar overlay de HPA demo e gravar evidencia.
12. Atualizar README, infra README e entrega PDF.
13. Gravar video.
14. Executar `terraform destroy` apos obter as evidencias, se o ambiente nao precisar ficar online.

## 6. Criterios de aceite finais

- `npm run build` passa.
- `npm test -- --runInBand` passa.
- `npm run test:e2e -- --runInBand` passa ou ha justificativa documentada.
- Imagem Docker publicada no registry escolhido.
- Terraform cria a infraestrutura do LAB ou documenta fallback permitido.
- Kubernetes tem Deployment, Service, ConfigMap, Secret, HPA e Jobs de migracao/seed.
- API responde em endpoint publico do LAB.
- Swagger/Postman demonstra os fluxos obrigatorios.
- HPA escala replicas sob carga simulada.
- CI/CD tem evidencia de build, testes, imagem e deploy.
- README contem arquitetura, execucao local, deploy Kubernetes, Terraform, APIs e video.
- PDF final contem os links exigidos pelo portal.

## 7. Riscos e mitigacoes

| Risco | Impacto | Mitigacao |
|---|---|---|
| LAB bloqueia EKS/IAM | Terraform atual nao aplica | Usar EC2 + K3s como caminho principal |
| LAB bloqueia RDS | Banco gerenciado nao cria | Usar PostgreSQL StatefulSet no K3s como fallback documentado |
| Credenciais AWS temporarias expiram | CD falha no GitHub Actions | Fazer Terraform no CloudShell/LAB e deploy por SSH, ou atualizar `AWS_SESSION_TOKEN` antes do CD |
| Imagem privada exige pull secret | Pods entram em `ImagePullBackOff` | Usar GHCR publico para demo ou criar `imagePullSecret` |
| HPA nao escala | Falta metrics-server ou carga baixa | Instalar metrics-server e usar overlay de demo com target menor |
| EC2 pequeno nao suporta max replicas | Pods ficam `Pending` | Limitar HPA demo a 4 replicas e ajustar requests |
| API nao acessivel externamente | Service e ClusterIP | Adicionar Ingress/Traefik ou NodePort e abrir Security Group |
| Migrations rodam em varios pods | Race no startup | Usar Kubernetes Job de migracao |
| Custos/creditos acabam | Ambiente cai antes da entrega | Gravar evidencias cedo e destruir recursos apos o video |

## 8. Fontes externas consultadas

- AWS EKS pricing: https://aws.amazon.com/eks/pricing/
- AWS EC2 documentation: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html
- AWS ECR documentation: https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html
- AWS RDS documentation: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html
- K3s documentation: https://docs.k3s.io/
- Kubernetes HPA documentation: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/
