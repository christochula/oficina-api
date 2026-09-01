# Relatório de validação local

Data: 31/08/2026.

## Checks concluídos

### `oficina-api`

- Build, lint e TypeScript aprovados, sem erros ou avisos.
- Jest: 62 suítes e 330 testes aprovados.
- Cobertura global: 90,74% de statements e 91,92% de linhas.
- Schema Prisma válido com URL apenas sintática; nenhuma conexão foi aberta.
- E2E alinhado ao JWT de cliente emitido pela Lambda, sem login local de cliente.

### `oficina-auth-serverless`

- Typecheck, lint e build aprovados.
- Jest: 7 suítes e 28 testes aprovados; cobertura global de 80,22%.
- JWT valida expiração, emissão, identificador, issuer, audience, algoritmo e tipo de token.
- Produção bloqueia integração privada sem hostname TLS; valor vazio não cria `tls_config`.

### Infraestrutura

- YAML, JSON, HCL, delimitadores, UTF-8, whitespace e contratos entre outputs/inputs foram auditados estaticamente.
- Verificados os limites de rede: VPC Link para ALB interno, IRSA restrita à fila, workloads para RDS Proxy e Proxy para RDS.
- Terraform, Helm, TFLint e Checkov possuem validações configuradas nas pipelines.

## Não executado nesta máquina

O Docker não foi iniciado nesta finalização. Após a falha anterior do computador, Testcontainers, build da imagem e stack local não foram executados. Terraform e Helm também não estão instalados localmente. Esses checks estão automatizados na CI e devem ser confirmados na primeira execução remota.

Dependem ainda de ambiente externo: `terraform plan/apply`, rollout EKS, tráfego e ingestão Datadog reais, monitores, assinatura SNS, URLs públicas, vídeo, PDF exportado, proteção efetiva de branches e convite a `soat-architecture`.

Após a primeira execução do GitHub Actions, confirme os nomes reais dos required checks antes de alinhar os contexts das regras de branch.
