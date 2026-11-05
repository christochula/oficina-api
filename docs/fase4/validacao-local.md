# Validação local da Fase 4

Validações executadas nesta implementação, com dados fictícios e sem provisionamento AWS.

| Componente | Resultado |
|---|---|
| OS Service | 551 testes / 95 suítes aprovados; cobertura de todo o runtime ativo |
| Billing | 64 testes aprovados, incluindo HTTP, JWT, persistência, mensageria, pagamento e tracing |
| Production | 63 testes aprovados, incluindo DynamoDB, estoque, HTTP, JWT, mensageria e tracing |
| Auth serverless | 55 testes aprovados; typecheck, lint e build aprovados |
| Portal | 64 testes aprovados; lint e build aprovados |
| BDD distribuído | 2 cenários / 10 etapas aprovados com três serviços, dois PostgreSQL e DynamoDB/SQS em LocalStack |
| Playwright | Fluxo no Chromium aprovado: aprovação, reparo, checkout, trava de pagamento e entrega |
| Resiliência | 4 cenários aprovados: estoque real, duplicatas, compensação/retry/tardias e reinício real do OS |
| Regressão da Fase 3 | 2 suítes / 6 testes E2E aprovados em PostgreSQL temporário via Testcontainers |
| Infra | Terraform fmt/validate aprovados; Helm lint aprovado; imagens dos três serviços construídas |

Cobertura de OS: [resumo JSON](coverage-summary.json). Os READMEs de Billing e Production incluem seus próprios resumos e comandos. `npm run test:cov -- --runInBand` no OS gera HTML em `coverage/lcov-report/index.html`; o CI publica os relatórios como artefatos. Código histórico de OS/estoque inativo no modo distribuído não compõe a cobertura ativa; os DTOs usados pelo portal continuam incluídos.

Comandos: `npm run test:bdd`, `npm run test:frontend:e2e` e `node --test test/phase4/resilience.cjs`. Para incluir o reinício real do OS no último comando, definir `ALLOW_SERVICE_RESTART=true`. Não executar testes de reinício simultaneamente aos testes do portal.

Os testes do pagamento usam um provedor HTTP simulado local. A assinatura, consulta e conferência do pagamento são exercitadas, mas o pagamento com contas Mercado Pago de teste, SonarCloud, deploy EKS e dashboards Datadog reais permanecem dependentes das configurações externas do grupo. Nenhuma evidência local representa uma execução desses ambientes externos.
