# Runbook de demonstração integrada

Este runbook é a sequência técnica reproduzível usada no vídeo e no aceite. Execute em homologação antes de gravar; substitua os marcadores e use um cliente sintético autorizado.

## Pré-condições

- Quatro pipelines verdes no mesmo conjunto de versões.
- API Gateway URL, Swagger e endpoint de health acessíveis.
- Cliente sintético ativo com CPF válido; o CPF não deve aparecer na tela após a chamada.
- `jq`, `curl`, `kubectl`, `aws`, `terraform` e `helm` disponíveis quando necessários.
- Dashboard Datadog aberto na janela `Past 15 Minutes`, filtro `env:homolog`.
- Notificações/sintéticos desativados ou direcionados a canal de teste durante falhas controladas.

## 1. Saúde pública

```bash
export API_URL="SUBSTITUIR_API_URL"
curl -sS -i "$API_URL/api/health/live"
curl -sS -i "$API_URL/api/health/ready"
```

Esperado: HTTP 200, JSON de estado e `X-Correlation-Id`. Se `live` passa e `ready` falha, investigar segredo, Proxy/RDS, migration e rede antes de continuar.

## 2. Autenticação serverless por CPF

Digite o CPF sintético sem deixá-lo no histórico do shell:

```bash
read -s CPF_TESTE
TOKEN=$(curl -sS -X POST "$API_URL/auth/token" \
  -H 'Content-Type: application/json' \
  --data "{\"cpf\":\"$CPF_TESTE\"}" | jq -r .access_token)
unset CPF_TESTE
test -n "$TOKEN" && test "$TOKEN" != null
```

Não decodifique nem projete o token no vídeo. Mostre o trace da Lambda, a ausência de CPF nos logs e a expiração curta.

## 3. Proteção da API

```bash
curl -sS -o /dev/null -w '%{http_code}\n' "$API_URL/api/v1/ordens-servico/minhas/lista"
curl -sS -o /tmp/oficina-os.json -w '%{http_code}\n' \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Correlation-Id: 02d71b58-80bf-4df6-8a7c-f80a28e781ce" \
  "$API_URL/api/v1/ordens-servico/minhas/lista"
```

Esperado: a primeira chamada é 401/403; a segunda respeita o vínculo do cliente e devolve o mesmo correlation ID.

## 4. Ordem de serviço e métricas

No Swagger/Postman, com dados sintéticos:

1. abrir uma OS;
2. iniciar diagnóstico e registrar diagnóstico;
3. aprovar orçamento com o token do cliente proprietário;
4. iniciar e concluir execução;
5. finalizar a OS.

Preservar o número/ID somente para conferência funcional. No Datadog, demonstrar incremento do volume, transições e duração de `diagnostico`, `execucao` e `finalizacao`.

## 5. CI/CD e infraestrutura

- Abrir um PR já aprovado e mostrar checks `Quality`, `E2E` e `Container`.
- Mostrar proteção de `homolog`/`main` e o workflow de deploy do SHA em execução/concluído.
- Mostrar o plan/aplicação Terraform sem abrir state ou secrets.
- No cluster, mostrar Deployment, HPA, PDB e pods distribuídos:

```bash
kubectl get deploy,hpa,pdb,pods -n oficina -o wide
kubectl rollout status deployment/oficina-api -n oficina
helm list -n oficina
```

## 6. Logs, trace e monitor

Buscar o correlation ID conhecido no Log Explorer, abrir o trace conectado e apontar os spans. Mostrar dashboard atualizado. Se houver janela controlada, exibir um monitor disparado e recuperado; não fabricar estado nem causar incidente em produção.

## 7. Encerramento seguro

```bash
unset TOKEN API_URL
```

- Apagar arquivos temporários contendo respostas/token.
- Confirmar que nenhum segredo, CPF real, token, state Terraform ou variável protegida ficou na gravação.
- Registrar links e SHAs no conteúdo-base do PDF final.

## Diagnóstico de bloqueios

| Falha | Pare e verifique |
|---|---|
| token não emitido | CPF sintético/checksum, cliente ativo, Proxy, secret e logs Lambda sanitizados |
| token emitido mas 403 | issuer/audience, segredo compartilhado, cliente ativo, policy do authorizer |
| 502/504 no Gateway | VPC Link, listener interno, target group, readiness e timeout |
| migration travada | ExternalSecret, conectividade, Prisma e lock no banco |
| dashboard sem evento | janela, `env`, Agent, DogStatsD e transição realmente concluída |
