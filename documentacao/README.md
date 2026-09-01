# Documentação do Tech Challenge 3

Esta pasta concentra a documentação compartilhada dos quatro repositórios. Os `README.md` nas raízes são as únicas exceções, pois fazem parte dos entregáveis obrigatórios.

## Arquitetura

- [Visão geral e diagrama de componentes](arquitetura/visao-geral.md)
- [Sequência de autenticação por CPF](arquitetura/sequencia-autenticacao.md)
- [Sequência de abertura de ordem de serviço](arquitetura/sequencia-abertura-os.md)
- [Modelo relacional, diagrama ER e justificativa do banco](arquitetura/modelo-dados.md)

## Decisões

- [RFC-001 - Nuvem AWS](rfc/RFC-001-nuvem-aws.md)
- [RFC-002 - PostgreSQL gerenciado](rfc/RFC-002-postgresql-gerenciado.md)
- [RFC-003 - Autenticação serverless por CPF](rfc/RFC-003-autenticacao-cpf.md)
- [RFC-004 - Observabilidade Datadog](rfc/RFC-004-observabilidade-datadog.md)
- [ADR-001 - Quatro repositórios](adr/ADR-001-quatro-repositorios.md)
- [ADR-002 - API Gateway e comunicação síncrona](adr/ADR-002-api-gateway-vpc-link.md)
- [ADR-003 - Escalabilidade com HPA](adr/ADR-003-hpa.md)
- [ADR-004 - Correlação e telemetria](adr/ADR-004-correlacao-telemetria.md)

## Operação e entrega

- [Deploy, promoção e configuração externa](operacao/deploy.md)
- [Datadog: sinais, dashboards, monitores e validação](operacao/datadog.md)
- [Runbook de demonstração](operacao/runbook-demonstracao.md)
- [Matriz de rastreabilidade](matriz-rastreabilidade.md)
- [Roteiro do vídeo de até 15 minutos](entrega/roteiro-video.md)
- [Conteúdo-base do PDF final](entrega/conteudo-pdf-final.md)
- [Checklist final de aceite](entrega/checklist-aceite.md)
- [Relatório de validação local](entrega/relatorio-validacao-local.md)

## Estado dos links externos

URLs de repositórios, deploys, vídeo, dashboards e execuções de pipeline permanecem como marcadores `SUBSTITUIR_*` até que os recursos sejam realmente publicados. Isso evita declarar como existente um estado externo que não pode ser criado apenas com os arquivos locais.

