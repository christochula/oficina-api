# Matriz de rastreabilidade — Fase 3

## Legenda

- **Implementado localmente**: existe em código e é validável sem conta externa.
- **Preparado**: automação/configuração existe, mas depende de AWS, GitHub ou Datadog.
- **Pendente externo**: exige publicação, execução real, convite ou link final.

| Requisito do desafio | Implementação/evidência | Estado antes da publicação |
|---|---|---|
| API Gateway na entrada | HTTP API em `oficina-auth-serverless`, integração Lambda e privada | Implementado localmente |
| Rotas sensíveis protegidas | Lambda authorizer e estratégia JWT no NestJS | Implementado localmente |
| Autenticação por CPF | `POST /auth/token`, normalização/checksum e consulta de cliente ativo | Implementado localmente |
| Retorno de JWT | token curto com issuer/audience e claims mínimas, sem CPF | Implementado localmente |
| Repositório Lambda | pasta/repositório `oficina-auth-serverless` | Implementado localmente |
| Repositório infra Kubernetes | pasta/repositório `oficina-infra-kubernetes` | Implementado localmente |
| Repositório infra banco | pasta/repositório `oficina-infra-database` | Implementado localmente |
| Repositório aplicação | pasta/repositório `oficina-api` | Implementado localmente |
| CI em cada repositório | workflows de testes, lint/build/validate/security conforme o tipo | Implementado localmente |
| CD automático em cada repositório | workflow OIDC para `homolog` e `main` | Preparado |
| Branch protegida e PR obrigatório | `.github/settings.yml` e procedimento de confirmação | Preparado/Pendente externo |
| Deploy de homologação | push/merge em `homolog` | Preparado |
| Deploy de produção | push/merge em `main`, environment `production` | Preparado |
| API Gateway como código | Terraform no serverless | Implementado localmente |
| Funções serverless como código | TypeScript + Terraform | Implementado localmente |
| Banco gerenciado como código | RDS PostgreSQL, Proxy, KMS, secret e parâmetros Terraform | Implementado localmente |
| Kubernetes escalável como código | EKS/nós/add-ons e Helm/HPA | Implementado localmente |
| Infraestrutura Terraform | módulos/raízes independentes e exemplos por ambiente | Implementado localmente |
| Integração Datadog | Operator/Agent, Lambda Extension, APM, logs e AWS integration | Implementado localmente |
| Latência da API | distribution `oficina.api.request.duration_ms` e monitor/dashboard | Implementado localmente |
| CPU do Kubernetes | Agent + dashboard/monitor | Preparado |
| Memória do Kubernetes | Agent + dashboard/monitor | Preparado |
| Saúde/uptime | `/live`, `/ready` e Synthetic API test | Implementado/Preparado |
| Falhas de processamento de OS | `oficina.service_orders.processing_errors` | Implementado localmente |
| Logs estruturados JSON | logger JSON em stdout e logs Lambda | Implementado localmente |
| Correlação de requisições | `X-Correlation-Id`, AsyncLocalStorage e IDs de trace/span | Implementado localmente |
| Volume diário de OS | `oficina.service_orders.created` no dashboard | Implementado localmente |
| Tempo médio em Diagnóstico | duration com `status:diagnostico` | Implementado localmente |
| Tempo médio em Execução | duration com `status:execucao` | Implementado localmente |
| Tempo médio em Finalização | duration com `status:finalizacao` | Implementado localmente |
| Erros de integração | `oficina.integrations.errors` no dashboard/monitor | Implementado localmente |
| Diagrama de componentes | `documentacao/arquitetura/visao-geral.md` | Implementado localmente |
| Sequência de autenticação | `documentacao/arquitetura/sequencia-autenticacao.md` | Implementado localmente |
| Sequência de abertura da OS | `documentacao/arquitetura/sequencia-abertura-os.md` | Implementado localmente |
| RFCs | `documentacao/rfc/` | Implementado localmente |
| ADRs | `documentacao/adr/` | Implementado localmente |
| Justificativa do banco | RFC-002 e `modelo-dados.md` | Implementado localmente |
| Mudanças/modelo ER | migration Prisma e diagrama ER | Implementado localmente |
| README por repositório | purpose, stack, execução/deploy e diagrama | Implementado localmente |
| Swagger/Postman | links no README da aplicação e coleção versionada | Implementado localmente |
| Vídeo de no máximo 15 min | `entrega/roteiro-video.md` | Suporte implementado; gravação pendente externa |
| Autenticação no vídeo | bloco 04:00–05:40 do roteiro | Pendente externo |
| CI/CD/deploy no vídeo | blocos 02:20–04:00 e 09:30–10:50 | Pendente externo |
| API protegida no vídeo | bloco 05:40–07:00 | Pendente externo |
| Dashboard ao vivo no vídeo | bloco 10:50–13:10 | Pendente externo |
| Logs/traces no vídeo | bloco 13:10–14:15 | Pendente externo |
| PDF final com quatro links | `entrega/conteudo-pdf-final.md` | Suporte implementado; publicação pendente externa |
| Link do vídeo no PDF | marcador dedicado | Pendente externo |
| Links de documentação no PDF | marcadores dedicados | Pendente externo |
| Usuário `soat-architecture` nos quatro repos | checklist e campo de confirmação | Pendente externo |

## Lacunas deliberadamente externas

Arquivos locais não conseguem provar URL publicada, pipeline executado, proteção efetivamente aplicada, dashboard recebendo tráfego, monitor disparado, vídeo hospedado ou usuário convidado. Esses itens só mudam para concluído após coleta da evidência indicada no checklist.

