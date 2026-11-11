# Datadog na Fase 4 — preparação por GitHub Actions

**Ingestão básica verificada em 11/11/2026 às 00:17:54 UTC (10/11 às 21:17:54 em São Paulo).** O ensaio posterior da OS #2 concluiu compensação, recuperação, pagamento e entrega; retornaram sinais Saga, p95 dos três serviços e um trace com os três serviços para parte do fluxo. Conferir horários e limites no [registro da evidência](datadog.md#evidência-verificada).

O procedimento autoritativo de bootstrap, plano e apply está em [Datadog por GitHub Actions](https://github.com/christochula/oficina-infra-kubernetes/blob/feature/phase4-distributed/docs/datadog-actions.md), no repositório de infraestrutura. Não seguir os antigos comandos manuais de Secrets Manager ou aplicar Terraform localmente para esta entrega.

## Configuração e custódia

- O titular prepara a conta/site e as chaves Datadog com permissões adequadas ao provider. Para US1: DD_SITE=datadoghq.com e DATADOG_API_URL=https://api.datadoghq.com/.
- No **Environment homolog** de oficina-infra-kubernetes, configurar os Secrets DATADOG_API_KEY e DATADOG_APP_KEY, além das três credenciais temporárias AWS. Nunca guardar valores em GitHub Variables, VITE_*, tfvars ou arquivos versionados.
- Usar **DATADOG_SECRET_ID=oficina/datadog** e DATADOG_ENABLED=true. O primeiro plano habilitado valida o par e inicializa esse secret por Actions, preservando valores existentes iguais; divergências exigem revisão, sem rotação automática.
- O apply copia o par canônico para o Secret Kubernetes datadog/datadog-credentials. Helm recebe apenas nomes de Secrets existentes; as chaves do provider vêm de variáveis de ambiente. Não publicar JSON de segredo, state ou plano binário como artifact.
- Variables de Environment prevalecem sobre as do repositório. Conferir o escopo homolog antes de solicitar qualquer operação.

## Plano e implantação

1. Usar o HEAD que passou no CI e o fluxo plan → revisão de texto/fingerprint → approved run → apply, conforme o guia de infraestrutura. A alternativa por tag está documentada no mesmo lugar. Não reaproveitar aprovação de plano com Datadog desabilitado ou de outro SHA.
2. EKS base deve estar ACTIVE. A aplicação usa namespace **oficina-fase4**; o Agent usa **datadog**.
3. Configurar API_BASE_URL com o **Gateway HTTPS** da gravação, sem barra final. Os healths dos três serviços usam essa mesma origem.
4. No OS, DD_ENABLED=true habilita tracing/métricas no chart; manter DD_TRACE_ENABLED e DD_METRICS_ENABLED habilitados também em Billing e Production pelos seus workflows. Conferir DD_ENV=homolog e os três DD_SERVICE.
5. Renovar sessões Academy e redeployar os aplicativos pelos workflows quando necessário para recarregar credenciais temporárias. Não criar Secrets Kubernetes manualmente para contornar o pipeline.

## Sinais disponíveis no Academy

O Agent Helm/DaemonSet e o Cluster Agent recebem APM TCP8126, DogStatsD UDP8125 e logs dos três serviços. O chart Datadog **3.270.0 também instalou um Deployment do Operator como dependência**; o Agent deste fluxo não é implantado por um recurso DatadogAgent e SSI não foi habilitado. A integração AWS cross-account permanece indisponível; não prometer métricas CloudWatch de RDS, Gateway/Lambda ou aws.sqs.* só pela instalação do Agent.

O OS exporta contagens aproximadas SQS/DLQ por GetQueueAttributes quando DD_METRICS_ENABLED=true. Essas métricas customizadas não dependem da integração AWS do Datadog. Ver contrato e consultas em [datadog.md](datadog.md).

O [apply 42929602706](https://github.com/christochula/oficina-infra-kubernetes/actions/runs/42929602706) concluiu no SHA 84c6494. O [apply de percentis 42932263134](https://github.com/christochula/oficina-infra-kubernetes/actions/runs/42932263134), SHA 917a94e, configurou duas métricas após plano revisado, sem alterações AWS. A ingestão e os sinais do ensaio foram comprovados no [dashboard de homologação](https://app.datadoghq.com/dashboard/u6t-x9c-awx/oficina--operao-e-observabilidade--homolog). Em outra sessão, reconferir recursos, período e ingestão; presença anterior de sinais não garante disponibilidade atual ou indexação de todo span.
