# Validação local da Fase 4

Validações executadas nesta implementação, com dados fictícios e sem provisionamento AWS.

| Componente | Resultado |
|---|---|
| OS Service | 551 testes / 95 suítes aprovados; cobertura de todo o runtime ativo |
| Billing | 64 testes aprovados, incluindo HTTP, JWT, persistência, mensageria, pagamento e tracing |
| Production | 63 testes aprovados, incluindo DynamoDB, estoque, HTTP, JWT, mensageria e tracing |
| Auth serverless | 55 testes aprovados; typecheck, lint e build aprovados |
| Portal | 77 testes aprovados, incluindo 11 de autenticação local; lint e build aprovados |
| Checkout de demonstração | 14 testes HTTP aprovados: recusa/aprovação, assinatura, idempotência, recuperação do webhook e persistência após reinício |
| BDD distribuído | 2 cenários / 10 etapas aprovados com três serviços, dois PostgreSQL e DynamoDB/SQS em LocalStack |
| Playwright | Fluxo no Chromium aprovado: aprovação, reparo, checkout, trava de pagamento e entrega |
| Navegador com formulários reais | 1 cenário aprovado: três logins, abertura/atribuição, diagnóstico/orçamento, aprovação por CPF, execução/consumo, recusa e nova tentativa de pagamento, retorno ao portal e entrega |
| Resiliência | 4 cenários aprovados: estoque real, duplicatas, compensação/retry/tardias e reinício real do OS |
| Regressão da Fase 3 | 2 suítes / 6 testes E2E aprovados em PostgreSQL temporário via Testcontainers |
| Infra | Terraform fmt/validate aprovados; Helm lint aprovado; imagens dos três serviços construídas |

Cobertura de OS: [resumo JSON](coverage-summary.json). Os READMEs de Billing e Production incluem seus próprios resumos e comandos. `npm run test:cov -- --runInBand` no OS gera HTML em `coverage/lcov-report/index.html`; o CI publica os relatórios como artefatos. Código histórico de OS/estoque inativo no modo distribuído não compõe a cobertura ativa; os DTOs usados pelo portal continuam incluídos.

Comandos: `npm run test:bdd`, `npm run test:frontend:e2e` e `node --test test/phase4/resilience.cjs`. Para incluir o reinício real do OS no último comando, definir `ALLOW_SERVICE_RESTART=true`. Não executar testes de reinício simultaneamente aos testes do portal.

Para testar manualmente o fluxo, consulte o [roteiro do navegador local](teste-navegador-local.md). O cenário adicional é executado por `npm run test:frontend:manual`, após o seed fictício e com `LOCAL_DEMO_MODE=true`. Ele usa os formulários e o checkout visível, sem injetar sessões nem confirmar pagamentos por helper. A pipeline Frontend executa ambos os cenários do portal.

Foi validada a recuperação de 11 preferências locais com seus IDs originais, preservando os dados de OS/Billing. O checkout anteriormente perdido da OS 25 respondeu HTTP 200 antes e depois de um reinício real do simulador; ID, referência e valor permaneceram iguais, sem aprovar seu pagamento. O Compose mantém o estado do simulador em arquivo montado fora do contêiner.

Os testes do pagamento usam um provedor HTTP simulado local. A assinatura, consulta e conferência do pagamento são exercitadas, mas o pagamento com contas Mercado Pago de teste, SonarCloud, deploy EKS e dashboards Datadog reais permanecem dependentes das configurações externas do grupo. Nenhuma evidência local representa uma execução desses ambientes externos.
