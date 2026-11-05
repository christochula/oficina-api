A autenticação por CPF passa a consultar o OS Service via HTTPS com token interno, removendo credenciais e consultas diretas ao banco de outro serviço. O Gateway roteia OS, Billing e Production, preserva o frontend e expõe as rotas específicas de webhook, lookup e OpenAPI com a autenticação adequada.

Validação: 55 testes, cobertura acima de 80% nas quatro métricas, lint/typecheck/build e Terraform fmt/validate aprovados. As novas variáveis e secrets estão documentadas; nenhuma configuração AWS foi aplicada.
