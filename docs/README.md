# Documentação — Tech Challenge Fase 3 (Oficina)

Documentação compartilhada dos quatro repositórios. Os `README.md` nas raízes de
cada repositório são os entregáveis obrigatórios individuais.

**Ambiente de execução:** AWS Academy Learner Lab. As adaptações em relação ao
desenho corporativo estão nas **ADR-005 a ADR-009**.

## Arquitetura

- [Visão geral e diagrama de componentes](arquitetura/visao-geral.md)
- [Diagrama de arquitetura cloud (macro)](arquitetura/diagrama-cloud.md)
- [Sequência — autenticação por CPF](arquitetura/sequencia-autenticacao.md)
- [Sequência — abertura de ordem de serviço](arquitetura/sequencia-abertura-os.md)
- [Modelo relacional, diagrama ER e justificativa do banco](arquitetura/modelo-dados.md)

## RFCs (decisões técnicas)

- [RFC-001 — Nuvem AWS](rfc/RFC-001-nuvem-aws.md)
- [RFC-002 — PostgreSQL gerenciado (RDS)](rfc/RFC-002-postgresql-gerenciado.md)
- [RFC-003 — Autenticação serverless por CPF](rfc/RFC-003-autenticacao-cpf.md)
- [RFC-004 — Observabilidade Datadog](rfc/RFC-004-observabilidade-datadog.md)

## ADRs (decisões arquiteturais)

- [ADR-001 — Quatro repositórios](adr/ADR-001-quatro-repositorios.md)
- [ADR-002 — API Gateway HTTP API com integração HTTP_PROXY](adr/ADR-002-api-gateway-vpc-link.md)
- [ADR-003 — Escalabilidade com HPA](adr/ADR-003-hpa.md)
- [ADR-004 — Correlação e telemetria](adr/ADR-004-correlacao-telemetria.md)
- [ADR-005 — LabRole e credenciais de sessão em vez de IRSA/OIDC](adr/ADR-005-aws-academy-labrole.md)
- [ADR-006 — Ingress via Service LoadBalancer](adr/ADR-006-ingress-service-loadbalancer.md)
- [ADR-007 — RDS público com TLS forçado](adr/ADR-007-rds-publico-tls.md)
- [ADR-008 — Escalabilidade por HPA + node group (sem Cluster Autoscaler)](adr/ADR-008-escalabilidade-hpa-node-group.md)
- [ADR-009 — Datadog Agent sem integração AWS↔Datadog](adr/ADR-009-datadog-agent-sem-integracao-aws.md)

## Operação

- [Runbook de deploy no AWS Academy](operacao/runbook-deploy-academy.md) — sequência de merge dos 4 repos
- [Setup da conta Datadog](operacao/datadog-setup.md) — passos manuais
- [Datadog: sinais, dashboards, monitores, validação](operacao/datadog.md)
- [Destroy / Cleanup](operacao/destroy.md)
- [Runbook de demonstração](operacao/runbook-demonstracao.md)
- [Deploy (referência)](operacao/deploy.md)

## Entrega

- [Roteiro do vídeo (≤15 min)](entrega/roteiro-video.md)
- [Checklist de aceite](entrega/checklist-aceite.md)
- [Conteúdo-base do PDF final](entrega/conteudo-pdf-final.md)
- [Matriz de rastreabilidade](matriz-rastreabilidade.md)

## Domínio (referência)

- [Dicionário ubíquo](dicionario-ubiquo.md)
- [Fluxos de negócio da oficina](fluxos-negocio-oficina.md)
- [Decisões de modelagem](decisoes-arquiteturais-oficina.md)
- [Guia de teste end-to-end](guia-teste-end-to-end.md)
- [Configuração de GitHub / Secrets Manager](guia-configuracao-github-secrets-manager.md)
- [Relatório OWASP ZAP](relatorio-analise-owasp-zap.md)
