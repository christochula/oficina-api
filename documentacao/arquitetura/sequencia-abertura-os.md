# Sequência de abertura de ordem de serviço

```mermaid
sequenceDiagram
  autonumber
  actor U as Operador autorizado
  participant G as API Gateway
  participant Z as Lambda Authorizer
  participant A as Oficina API
  participant C as Domínio/Use Case
  participant P as Prisma
  participant D as PostgreSQL
  participant M as DogStatsD/APM

  U->>G: POST /api/v1/ordens-servico + JWT + correlação
  G->>Z: Validar JWT
  Z-->>G: allow + subject/role
  G->>A: VPC Link -> ALB -> Pod
  A->>C: AbrirOrdemServicoUseCase
  C->>P: Validar cliente, veículo, serviços e estoque
  P->>D: Leituras parametrizadas
  D-->>C: Entidades válidas
  C->>C: Criar aggregate OS em RECEBIDA
  C->>P: Salvar OS + ORDEM_ABERTA em transação
  P->>D: INSERT ordem, itens e histórico
  D-->>P: Commit + número operacional
  P->>M: oficina.service_orders.created
  P->>M: status_transition:recebida
  C-->>A: Ordem persistida
  A->>M: Trace, latência e log JSON correlacionado
  A-->>U: 201 {data, X-Correlation-Id}

  alt Falha inesperada
    A->>M: processing_errors + log error + stack + trace
    A-->>U: 500 sem detalhes internos
  end
```

## Consistência

- A ordem e o primeiro evento de histórico são persistidos na mesma transação.
- O número operacional é gerado pelo PostgreSQL; o ID técnico usa ULID prefixado.
- Chaves estrangeiras preservam cliente, veículo, catálogo, orçamento, peças e histórico.
- Transições posteriores registram status anterior, status novo e timestamp. Ao sair de `EM_DIAGNOSTICO`, `EM_EXECUCAO` ou `FINALIZADA`, a duração é emitida ao Datadog.
- Falha de persistência não emite métrica de sucesso e incrementa o contador de processamento com baixa cardinalidade.

