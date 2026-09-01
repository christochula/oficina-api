# Roteiro do vídeo final — duração-alvo 14min30s

O limite do desafio é 15 minutos. Grave em 1080p, aumente a fonte e deixe abas/terminais preparados. Não mostre CPF real, JWT, segredo, state Terraform, variáveis protegidas ou dados pessoais.

## Antes de gravar

- Execute integralmente o [runbook de demonstração](../operacao/runbook-demonstracao.md).
- Use cliente/veículo/OS sintéticos e limpe histórico do terminal.
- Fixe a janela do Datadog em `Past 15 Minutes` e `env:homolog`.
- Tenha os quatro repositórios, actions, API Gateway, Swagger e Datadog em abas separadas.
- Ative relógio/cronômetro visível para controlar o limite.

## Linha do tempo

### 00:00–00:35 — Abertura

Fala sugerida: “Esta é a Fase 3 da Oficina. A entrega separa aplicação, autenticação serverless, Kubernetes e banco em quatro repositórios, com AWS, Terraform, CI/CD e observabilidade Datadog.”

Mostrar rapidamente o commit/tag e os quatro links, sem navegar ainda.

### 00:35–02:20 — Arquitetura

Abrir o diagrama de componentes. Explicar o caminho:

1. cliente entra no API Gateway;
2. CPF é validado pela Lambda e um JWT curto é emitido;
3. Lambda authorizer protege rotas;
4. VPC Link e ALB interno encaminham ao EKS;
5. API usa RDS PostgreSQL privado;
6. Datadog coleta cluster, APM, logs, Lambda e métricas de negócio.

Mencionar a separação de responsabilidades dos quatro repositórios e o risco registrado de CPF sem segundo fator.

### 02:20–04:00 — CI/CD e segurança da entrega

Mostrar:

- pull request com checks verdes;
- proteção de `homolog` e `main`, revisão obrigatória e force-push bloqueado;
- OIDC em vez de AWS keys;
- deploy de homologação e produção;
- SHA imutável no ECR/Lambda e plan Terraform revisado.

Não abrir logs que revelem variáveis.

### 04:00–05:40 — Autenticação por CPF

No Swagger/Postman, executar `POST /auth/token` com cliente sintético ativo. Mostrar HTTP 200 e apenas a presença/expiração do token, nunca o valor completo. Executar também uma tentativa inválida e destacar a resposta genérica.

Explicar checksum, normalização, consulta via RDS Proxy/TLS, cliente ativo, CPF fora do token/log e TTL curto.

### 05:40–07:00 — API protegida

Executar a mesma rota privada:

1. sem bearer token: 401/403;
2. com token: sucesso somente para recursos do cliente;
3. mostrar `X-Correlation-Id` na requisição e resposta.

### 07:00–09:30 — Fluxo da ordem de serviço

Criar/usar uma OS de teste e avançar, de forma preparada, por abertura, Diagnóstico, aprovação, Execução e Finalização. Mostrar o histórico e explicar que a criação inicial agora persiste histórico na mesma transação.

Se todas as etapas não couberem, use requests previamente salvos e mostre apenas respostas essenciais; não acelerar a ponto de ficar ilegível.

### 09:30–10:50 — Deploy e Kubernetes

Mostrar o workflow concluído e então:

```bash
kubectl get deploy,hpa,pdb,pods -n oficina -o wide
kubectl rollout status deployment/oficina-api -n oficina
```

Apontar dois pods mínimos, HPA 2–10, probes, PDB, tag/version igual ao SHA e RDS privado. Mostrar `/api/health/live` e `/api/health/ready` em 200.

### 10:50–13:10 — Dashboard Datadog ao vivo

Atualizar o dashboard e mostrar:

- volume diário de OS;
- tempo médio/p95 em Diagnóstico, Execução e Finalização;
- erros de integração;
- p95 da API;
- CPU/memória do Kubernetes;
- health/uptime e falhas de processamento.

Abrir um monitor configurado e, se já houver evidência segura, mostrar ciclo de alerta/recuperação em homologação.

### 13:10–14:15 — Logs e traces correlacionados

Buscar o correlation ID da chamada. Mostrar o evento JSON, `service/env/version`, `dd.trace_id` e o trace conectado com spans. Destacar que CPF/JWT não aparece.

### 14:15–14:30 — Encerramento

Fala sugerida: “Os links dos quatro repositórios, documentação, vídeo e evidências estão no PDF de entrega. O usuário `soat-architecture` foi adicionado aos quatro repositórios.”

Só faça a última afirmação depois de confirmar o convite/colaboração.

## Plano de corte se ultrapassar o tempo

Remova detalhes de comandos e explicações de alternativas. Não corte autenticação, proteção da API, CI/CD/deploy, dashboard ao vivo, logs/traces ou os quatro repositórios, pois são evidências explícitas do desafio.

