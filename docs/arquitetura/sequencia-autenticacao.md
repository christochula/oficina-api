# Sequência de autenticação por CPF

```mermaid
sequenceDiagram
  autonumber
  actor C as Cliente
  participant G as API Gateway
  participant L as Lambda Auth
  participant S as Secrets Manager
  participant D as PostgreSQL (RDS)
  participant A as Lambda Authorizer
  participant B as Oficina API/EKS
  participant DD as Datadog

  C->>G: POST /auth/token {cpf} + X-Correlation-Id
  G->>L: Evento HTTP API
  L->>L: Normaliza e valida dígitos do CPF
  L->>S: Obtém credenciais DB e segredo JWT
  S-->>L: Segredos em memória
  L->>D: SELECT id, ativo FROM clientes WHERE tipoDoc='CPF' AND numeroDoc=$1 (TLS)
  D-->>L: id e status ativo
  alt CPF inválido, cliente ausente ou inativo
    L->>DD: Métrica auth.failure + log sem CPF
    L-->>C: 401 resposta genérica
  else Cliente ativo
    L->>L: JWT HS256 curto, iss/aud/sub/jti/role/scopes
    L->>DD: Trace + auth.success
    L-->>C: 200 access_token, token_type, expires_in
  end

  C->>G: Requisição privada + Bearer JWT
  G->>A: Autoriza token (cache desabilitado/route-aware)
  A->>S: Lê segredo JWT em cold start
  A->>A: Valida assinatura, exp, iss, aud e scopes
  A-->>G: allow/deny + headers x-auth-* mínimos
  G->>B: HTTP_PROXY (internet) -> ELB publico do EKS, propaga correlação/trace
  B->>D: Revalida cliente ativo e executa caso de uso
  B-->>C: Resposta da API
```

## Regras

- Aceitar CPF com ou sem máscara, normalizar para 11 dígitos e rejeitar sequências repetidas/dígitos verificadores inválidos.
- A mesma resposta `401` é usada para CPF inválido, ausente ou inativo, reduzindo enumeração.
- Consultas são parametrizadas; o CPF nunca aparece em logs, tags Datadog ou JWT.
- Claims mínimas: `sub`/`client_id` interno, `role=CLIENTE`, `token_use=client`, `scopes`, `iss`, `aud`, `iat`, `exp` e `jti`.
- O backend faz defesa em profundidade: valida o token e consulta novamente o status do cliente.
- `X-Correlation-Id` e contexto de trace seguem Gateway, Lambdas e EKS.

## Limitação conhecida

O enunciado exige autenticação via CPF, mas CPF não é segredo. A solução aplica throttling no API Gateway, TTL curto e não exposição de PII; WAF e segundo fator (OTP) são evoluções recomendadas para produção real, sem alterar a interface do authorizer.

