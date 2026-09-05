# ADR-008 — Escalabilidade por HPA + managed node group (sem Cluster Autoscaler)

- Status: aceita
- Data: 2026-09-03

## Contexto

O requisito é "cluster Kubernetes com capacidade de escalabilidade". O desenho
original tinha HPA (pods) **e** Cluster Autoscaler (nós). O Cluster Autoscaler
precisa de IRSA (ADR-005).

## Decisão

- **Escala de pods:** `HorizontalPodAutoscaler` v2 por CPU (70%) e memória (75%),
  `minReplicas: 2` / `maxReplicas: 8`, servido pelo **metrics-server** instalado
  no cluster (Helm, sem IRSA).
- **Escala de nós:** managed node group com `min_size: 2` / `max_size: 4`.
  Sem Cluster Autoscaler; o `desired_size` é ajustado manualmente quando
  necessário (`lifecycle.ignore_changes` no `desired_size` evita conflito).

## Consequências

- A demonstração de escalabilidade é o **HPA** (aumento de réplicas sob carga),
  que é o mecanismo que o enunciado enfatiza.
- A capacidade de nós é fixa entre `min` e `max`; suficiente para 8 réplicas de
  `t3.medium`. Se precisar de mais nós, ajustar `node_desired_size` e reaplicar.
- Restaurar o Cluster Autoscaler em conta real = readicionar o `helm_release` +
  o IRSA (código no histórico) + as tags de ASG.
