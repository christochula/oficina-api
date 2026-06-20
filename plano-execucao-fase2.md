# Plano de Execucao Fase 2 (Karina solo)

Data de inicio: 20/06/2026  
Prazo final da fase: 14/07/2026

## Objetivo em 2 dias (20/06 e 21/06)

Fechar o caminho critico da entrega sem depender da dupla:

1. APIs obrigatorias da fase 2 implementadas.
2. Testes dos fluxos criticos alterados passando.
3. Estrutura Kubernetes pronta (Deployment, Service, ConfigMap, Secret, HPA).
4. CI operacional (build, test, imagem Docker).
5. Base de CD e Terraform pronta para consolidar deploy.
6. README com secao da fase 2 em andamento.

---

## Definicao de pronto (ate o fim do Dia 2)

- [ ] Regras de listagem da OS aderentes ao enunciado.
- [ ] Endpoint de aprovacao externa de orcamento implementado.
- [ ] Abertura de OS aderente ao requisito da fase 2.
- [ ] Testes dos novos fluxos passando.
- [ ] Manifestos em pasta k8s criados e aplicaveis.
- [ ] HPA configurado com evidencia de escalabilidade.
- [ ] Estrutura Terraform em pasta infra criada e documentada.
- [ ] Workflow de CI criado em .github/workflows.
- [ ] README atualizado com arquitetura e instrucoes da fase 2.

---

## Dia 1 - Execucao numero por numero

### 1) Fechar escopo tecnico (max 45 min)

Objetivo: travar o que e obrigatorio e evitar retrabalho.

Checklist:
- [ ] Confirmar requisitos obrigatorios que vao para codigo agora.
- [ ] Congelar criterios de aceite de cada endpoint alterado.
- [ ] Registrar decisoes no proprio arquivo (se necessario).

Saida esperada:
- Lista de requisitos implementaveis hoje, sem ambiguidades.

Escopo fechado para hoje (implementar):
1. Listagem de OS com ordenacao por prioridade de status e mais antigas primeiro.
2. Exclusao logica de FINALIZADA e ENTREGUE da listagem padrao.
3. Endpoint para aprovacao/rejeicao externa de orcamento.
4. Ajuste da abertura de OS para aderir ao requisito da fase 2.
5. Testes dos fluxos alterados.
6. Pipeline CI minima (build + test).

Fora do escopo de hoje (deixar para Dia 2+):
1. Deploy completo em cloud via Terraform.
2. Ajustes finos de observabilidade.
3. Refinos nao obrigatorios de arquitetura.

Criterios de aceite congelados (Dia 1):
1. Regras de listagem devem ser reproduziveis por teste automatizado.
2. Endpoint externo deve aceitar aprovacao e recusa com validacao minima de payload.
3. Abertura de OS deve retornar identificador unico consistente.
4. Nenhum item concluido sem teste cobrindo fluxo principal e erro relevante.

### 2) Regra de listagem de OS (max 2h)

Objetivo: aderir exatamente ao enunciado.

Checklist:
- [ ] Ordenar por prioridade de status:
  - EM_EXECUCAO
  - AGUARDANDO_APROVACAO
  - EM_DIAGNOSTICO
  - RECEBIDA
- [ ] Dentro de cada status, mais antigas primeiro.
- [ ] Excluir FINALIZADA e ENTREGUE da listagem padrao.
- [ ] Manter paginacao funcionando.

Saida esperada:
- Endpoint de listagem conforme regra da fase 2.

### 3) Endpoint de aprovacao externa (max 1h30)

Objetivo: receber aprovacao/recusa via notificacao externa.

Checklist:
- [ ] Criar endpoint dedicado de callback/webhook.
- [ ] Validar payload e campos obrigatorios.
- [ ] Mapear aprovado/reprovado para os casos de uso corretos.
- [ ] Tratar idempotencia minima (nao quebrar com chamada repetida).

Saida esperada:
- Endpoint funcional para aprovacao/rejeicao externa.

### 4) Abertura de OS conforme fase 2 (max 1h30)

Objetivo: aderir ao payload exigido no enunciado.

Checklist:
- [ ] Revisar DTO e use case de abertura da OS.
- [ ] Garantir recebimento de cliente, veiculo, servicos e pecas.
- [ ] Retornar identificador unico da OS.
- [ ] Validar entradas criticas.

Saida esperada:
- Abertura de OS ajustada ao requisito.

### 5) Testes dos fluxos alterados (max 1h30)

Objetivo: blindar regressao e preparar pipeline.

Checklist:
- [ ] Teste da listagem com ordenacao e exclusao logica.
- [ ] Teste do endpoint de aprovacao externa.
- [ ] Teste da abertura de OS ajustada.
- [ ] Rodar suite local e corrigir falhas relevantes.

Saida esperada:
- Testes essenciais passando no local.

### 6) CI minima operacional (max 45 min)

Objetivo: validar automaticamente a cada push.

Checklist:
- [ ] Criar workflow com install + build + test.
- [ ] Confirmar gatilho em push e pull_request.
- [ ] Garantir falha da pipeline em caso de erro de teste.

Saida esperada:
- Base de CI funcional em .github/workflows.

---

## Dia 2 - Consolidacao infra e entrega parcial

### 1) Manifestos Kubernetes

Checklist:
- [ ] k8s/deployment.yaml
- [ ] k8s/service.yaml
- [ ] k8s/configmap.yaml
- [ ] k8s/secret.yaml
- [ ] k8s/hpa.yaml

### 2) Validacao de deploy + HPA

Checklist:
- [ ] Aplicacao sobe com variaveis corretas.
- [ ] Healthcheck responde.
- [ ] HPA com metricas de CPU/memoria configurado.

### 3) Estrutura Terraform

Checklist:
- [ ] infra/main.tf
- [ ] infra/variables.tf
- [ ] infra/outputs.tf
- [ ] infra/providers.tf
- [ ] README de infra com passo a passo de apply.

### 4) Pipeline (evolucao)

Checklist:
- [ ] Build de imagem Docker.
- [ ] Etapa de deploy (quando ambiente permitir).
- [ ] Estrutura pronta para apply de K8s.

### 5) README fase 2

Checklist:
- [ ] Arquitetura proposta.
- [ ] Fluxo CI/CD.
- [ ] Execucao local.
- [ ] Deploy em Kubernetes.
- [ ] Provisionamento com Terraform.

---

## Riscos e contorno

### Risco 1: AWS indisponivel/permissao insuficiente

Contorno:
- Fechar toda estrutura Terraform e K8s localmente.
- Deixar comandos e evidencias prontas para aplicar assim que liberar acesso.

### Risco 2: Tempo curto para refinamento

Contorno:
- Priorizar obrigatorios do enunciado.
- Adiar melhorias nao obrigatorias para depois de 21/06.

---

## Ordem de execucao imediata (agora)

1. Iniciar Dia 1 - Item 1 (fechar escopo tecnico).
2. Em seguida Dia 1 - Item 2 (listagem de OS).
3. Depois Dia 1 - Item 3 (aprovacao externa).
4. Prosseguir com Itens 4, 5 e 6.

Status atual:
- [x] Dia 1 - Item 1 iniciado
- [x] Dia 1 - Item 1 concluido
- [x] Dia 1 - Item 2 iniciado
- [x] Dia 1 - Item 2 concluido
- [x] Dia 1 - Item 3 iniciado
- [x] Dia 1 - Item 3 concluido
- [x] Dia 1 - Item 4 iniciado
- [x] Dia 1 - Item 4 concluido
- [x] Dia 1 - Item 5 iniciado
- [x] Dia 1 - Item 5 concluido
- [x] Dia 1 - Item 6 iniciado
- [x] Dia 1 - Item 6 concluido
