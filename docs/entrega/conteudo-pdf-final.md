# Conteúdo-base do PDF final de entrega

> Este Markdown é o suporte solicitado para montar o PDF no portal. Substitua todos os marcadores e valide os links em janela anônima antes de exportar. Não transforme o arquivo em PDF até que o estado externo seja real.

## Identificação

- Projeto: Tech Challenge — Fase 3 — Oficina
- Turma: 13SOAT
- Integrantes: `SUBSTITUIR_NOMES_RM`
- Commit/versão demonstrada: `SUBSTITUIR_SHA_OU_TAG`
- Data da entrega: `SUBSTITUIR_DATA`

## Repositórios

1. Aplicação no Kubernetes — https://github.com/christochula/oficina-api
2. Autenticação/Lambda/API Gateway — https://github.com/christochula/oficina-auth-serverless
3. Infraestrutura Kubernetes/Datadog — https://github.com/christochula/oficina-infra-kubernetes
4. Infraestrutura do banco gerenciado — https://github.com/christochula/oficina-infra-database

## Vídeo

- Demonstração (até 15 minutos): `SUBSTITUIR_URL_VIDEO`
- Duração final: `SUBSTITUIR_DURACAO`

## Documentação

- Índice: `SUBSTITUIR_URL_DOCS_README`
- Diagrama de componentes: `SUBSTITUIR_URL_DIAGRAMA_COMPONENTES`
- Sequência de autenticação: `SUBSTITUIR_URL_SEQUENCIA_AUTENTICACAO`
- Sequência de abertura de OS: `SUBSTITUIR_URL_SEQUENCIA_ABERTURA_OS`
- Modelo de dados/ER e justificativa: `SUBSTITUIR_URL_MODELO_DADOS`
- RFCs: `SUBSTITUIR_URL_RFCS`
- ADRs: `SUBSTITUIR_URL_ADRS`
- Operação Datadog: `SUBSTITUIR_URL_DATADOG`
- Matriz de rastreabilidade: `SUBSTITUIR_URL_MATRIZ`

## Endpoints e evidências

- API Gateway de homologação: `SUBSTITUIR_URL_API_HOMOLOG`
- Swagger: `SUBSTITUIR_URL_SWAGGER`
- Health: `SUBSTITUIR_URL_HEALTH`
- Dashboard Datadog: `SUBSTITUIR_URL_DASHBOARD`
- Execução CI/CD homologação: `SUBSTITUIR_URL_ACTION_HOMOLOG`
- Execução CI/CD produção: `SUBSTITUIR_URL_ACTION_PRODUCAO`

## Resumo da solução

A entrada pública usa **API Gateway HTTP API**. Uma **Lambda** valida o CPF e o
cliente ativo (consulta ao RDS via TLS), emitindo um **JWT HS256 curto**; um
**Lambda authorizer** protege `ANY /api/{proxy+}`. Após autorização, o API
Gateway faz **HTTP_PROXY** para o **ELB público** de um `Service type:
LoadBalancer` do **Amazon EKS**, onde roda a aplicação **NestJS**. A persistência
é **Amazon RDS PostgreSQL 16** (endpoint público com `rds.force_ssl`).
Notificações são desacopladas em **SQS → Lambda → SNS**. **Terraform** provisiona
a nuvem e os recursos Datadog; **GitHub Actions** (credenciais de sessão do AWS
Academy) valida e aplica no merge para `main`. **Datadog** agrega APM, logs JSON
correlacionados (`correlation_id` ↔ `dd.trace_id`), métricas de Kubernetes e as
métricas de negócio de ordens de serviço.

O ambiente é o **AWS Academy Learner Lab**; as adaptações em relação ao desenho
corporativo (LabRole em vez de IRSA/OIDC, ingress público, RDS público com TLS,
sem RDS Proxy / Cluster Autoscaler / integração AWS↔Datadog) estão documentadas
em `docs/adr/ADR-005` a `ADR-009`, com o caminho de reversão para conta real.

## Confirmação de acesso

Confirmamos que o usuário GitHub `soat-architecture` foi adicionado aos quatro repositórios acima e possui acesso verificável na data `SUBSTITUIR_DATA_CONFIRMACAO`.

- Evidência/observação: `SUBSTITUIR_LINK_OU_DESCRICAO_EVIDENCIA`
- Responsável pela confirmação: `SUBSTITUIR_RESPONSAVEL`

Não mantenha essa confirmação se o convite estiver pendente, expirado ou sem acesso efetivo.

## Declaração de validação

- [ ] Os quatro links abrem o repositório correto.
- [ ] O vídeo abre sem solicitar permissão indevida e tem até 15 minutos.
- [ ] Links de documentação apontam para o SHA/tag entregue.
- [ ] Swagger, health, dashboard e workflows correspondem ao ambiente mostrado.
- [ ] Nenhuma credencial, CPF real, JWT ou dado pessoal aparece no PDF/vídeo.
- [ ] `soat-architecture` consta em todos os repositórios.

