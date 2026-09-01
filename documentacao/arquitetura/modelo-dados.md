# Modelo relacional e escolha do banco

## Decisão

PostgreSQL gerenciado no Amazon RDS foi escolhido porque o domínio contém transações multi-entidade, invariantes, relacionamentos e consultas analíticas por tempo/status. Integridade referencial, ACID, índices compostos, `Decimal` e migrations versionadas são mais adequados do que um modelo sem esquema para ordens, orçamento e estoque.

O RDS reduz operação de patching, backup e failover. Produção usa Multi-AZ, armazenamento e snapshots criptografados, backups com point-in-time recovery, Performance Insights, Enhanced Monitoring e logs exportados. O RDS Proxy reduz tempestades de conexão das Lambdas e exige TLS.

## Diagrama ER resultante

```mermaid
erDiagram
  USUARIO ||--o| CLIENTE : "identidade opcional"
  USUARIO ||--o{ ORDEM_SERVICO : "mecânico responsável"
  CLIENTE ||--o{ ORDEM_SERVICO : possui
  VEICULO ||--o{ ORDEM_SERVICO : atendido
  ORDEM_SERVICO ||--o{ PROBLEMA_RELATADO : contém
  ORDEM_SERVICO ||--o{ SERVICO_SOLICITADO : solicita
  SERVICO_OFICINA ||--o{ SERVICO_SOLICITADO : referencia
  ORDEM_SERVICO ||--o| DIAGNOSTICO : possui
  ORDEM_SERVICO ||--o| ORCAMENTO : possui
  ORCAMENTO ||--o{ GRUPO_ORCAMENTO : agrupa
  GRUPO_ORCAMENTO ||--o{ LINHA_SERVICO : contém
  PECA o|--o{ LINHA_SERVICO : material
  PECA ||--o| ESTOQUE : saldo
  ORDEM_SERVICO ||--o{ CONSUMO_PECA : consome
  PECA ||--o{ CONSUMO_PECA : item
  ORDEM_SERVICO ||--o{ HISTORICO_OS : transiciona

  USUARIO {
    string id PK
    string email UK
    enum papel
    boolean ativo
  }
  CLIENTE {
    string id PK
    string usuarioId FK
    enum tipoDoc
    string numeroDoc UK
    boolean ativo
  }
  VEICULO {
    string id PK
    string placa UK
    string renavam UK
    string chassi UK
  }
  ORDEM_SERVICO {
    string id PK
    int numero UK
    enum status
    string clienteId FK
    string veiculoId FK
    string mecanicoResponsavelId FK
    datetime criadoEm
  }
  HISTORICO_OS {
    string id PK
    string ordemServicoId FK
    enum evento
    enum statusAnterior
    enum statusNovo
    datetime criadoEm
  }
  ORCAMENTO {
    string id PK
    string ordemServicoId FK_UK
    decimal total
  }
  GRUPO_ORCAMENTO {
    string id PK
    string orcamentoId FK
    decimal total
  }
  LINHA_SERVICO {
    string id PK
    string grupoId FK
    enum tipo
    decimal quantidade
    decimal valorUnitario
    decimal subtotal
    string pecaId FK
  }
  PECA {
    string id PK
    string codigo UK
    decimal precoVenda
  }
  ESTOQUE {
    string id PK
    string pecaId FK_UK
    decimal quantidadeDisponivel
    decimal quantidadeMinima
  }
```

## Ajustes efetuados para a Fase 3

1. O histórico de OS já armazenava evento, status anterior, status novo e timestamp; a persistência da entrada inicial foi corrigida para ocorrer junto da criação da ordem.
2. Foi adicionado índice `clientes(tipoDoc, ativo)` para apoiar autenticação, mantendo `numeroDoc` único para busca direta.
3. Foi adicionado índice `ordens_servico(status, criadoEm)` para volume/status por janela.
4. Foi adicionado índice `historico_os(statusNovo, criadoEm)` para análises temporais e auditoria.
5. Migrations permanecem no repositório da aplicação, versionadas com a alteração de domínio; o repositório de banco provisiona somente a plataforma.

## Integridade e performance

- `numeroDoc`, placa, RENAVAM, chassi, e-mail, código de peça e número da OS possuem unicidade conforme a regra do domínio.
- FKs impedem referências órfãs; exclusões funcionais usam campo `ativo` em vez de apagar histórico.
- Valores monetários e quantidades usam `Decimal`, evitando ponto flutuante binário.
- Índices de alta utilidade têm baixa cardinalidade de combinação e campos temporais; não se indexa texto livre.
- Métricas no Datadog não substituem o histórico relacional: o banco continua sendo a fonte de verdade auditável.

## Backup e restauração

- Homologação: retenção menor e destruição controlada, conforme `homolog.tfvars`.
- Produção: retenção ampliada, deletion protection, snapshot final, janela de backup/manutenção e PITR.
- O runbook de restauração deve criar nova instância a partir de snapshot/PITR, validar migrations e trocar endpoint/secret; nunca restaurar destrutivamente sobre produção.

