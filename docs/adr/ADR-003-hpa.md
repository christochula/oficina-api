# ADR-003 — Escalabilidade horizontal e disponibilidade no EKS

- Status: aceita
- Data: 2026-08-31

## Contexto

A aplicação deve ser escalável e monitorada por CPU e memória. Um único pod ou um único nó não oferece disponibilidade suficiente para rollout e manutenção.

## Decisão

- Executar no mínimo dois pods em produção e homologação compartilhada.
- Usar HPA de 2 a 10 réplicas, alvo de 70% de CPU e 75% de memória.
- Definir requests/limits, readiness/startup/liveness probes, PDB e distribuição entre nós/zonas.
- Usar grupos de nós gerenciados e autoscaling do cluster para acomodar pods pendentes.
- Publicar imagem imutável identificada pelo SHA do commit.

## Consequências

- HPA de CPU/memória reage a saturação, não substitui métricas de fila nem teste de carga.
- Requests incorretos distorcem percentuais; devem ser calibrados em homologação.
- PDB protege manutenção voluntária, mas não impede falha simultânea da infraestrutura.
- Limites iniciais são hipóteses operacionais e precisam ser ajustados com dados reais.

