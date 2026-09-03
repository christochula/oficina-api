# RFC-003 — Autenticação serverless por CPF

- Status: aceita com risco registrado
- Data: 2026-08-31
- Responsáveis: equipe SOAT

## Contexto

O enunciado solicita que rotas sensíveis sejam protegidas por um fluxo no qual uma função serverless recebe CPF, consulta a existência e o estado do cliente e emite JWT. CPF, isoladamente, é um identificador público e não comprova posse nem identidade.

## Proposta da fase

Criar no repositório `oficina-auth-serverless`:

1. `POST /auth/token`, público e limitado por throttling, recebe `{ "cpf": "..." }`.
2. A Lambda normaliza o CPF, valida seus dígitos e consulta, via RDS Proxy/TLS, um cliente ativo.
3. Em caso válido, emite JWT HS256 curto com `sub`, `client_id`, `role=CLIENTE`, `token_use=client`, `iss`, `aud`, `iat` e `exp`.
4. Um Lambda authorizer valida assinatura, emissor, audiência e tipo antes de liberar rotas privadas.
5. CPF não entra no token, logs ou métricas. Respostas inválidas são genéricas para reduzir enumeração.

O segredo JWT fica no Secrets Manager e é compartilhado com a estratégia JWT do NestJS. O identificador do cliente no token é revalidado pela aplicação, inclusive o campo `ativo`.

## Controles compensatórios

- Validação de checksum e normalização canônica.
- TTL curto, segredo forte e rotação controlada.
- Throttling no API Gateway e métrica de falhas de autenticação.
- Logs JSON sem corpo, documento ou token.
- Banco e Lambda privados; conexão pelo Proxy com TLS.
- Resposta uniforme para CPF inválido, inexistente ou inativo.

## Risco aceito e evolução recomendada

O fluxo reproduz o requisito acadêmico, mas não deve ser tratado como autenticação forte em produção. Antes de uso com dados reais, exigir segundo fator ou prova de posse, por exemplo OTP enviado a canal previamente cadastrado, passkey/OIDC ou credencial com senha. Também são recomendados WAF, detecção de abuso, bloqueio progressivo, auditoria e RS256/ES256 com rotação por chave pública.

## Alternativas consideradas

- Cognito/OIDC com MFA: preferível em produção, porém extrapola o fluxo obrigatório baseado em Lambda e consulta do CPF.
- JWT assimétrico: melhora separação entre emissor e validadores; fica como evolução porque a integração atual também preserva tokens legados HS256 da aplicação.
- Autorizar pelo API Gateway sem revalidar cliente na aplicação: rejeitado; a desativação de cliente precisa surtir efeito no domínio.

## Critérios de aceite

- Testes cobrem CPF formatado, checksum inválido, inexistente, inativo e ativo.
- Token não contém CPF e expira no limite configurado.
- Rotas privadas rejeitam token ausente, alterado, expirado, de emissor/audiência incorretos ou cliente inativo.

