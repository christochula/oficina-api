# Pronto para gravar — Fase 4

Referência: ensaio real de **10/11/2026, São Paulo**, concluído com a **OS #2 ENTREGUE, R$175**. Usar o [roteiro de 14min30s](roteiro-video.md) e o [checklist](checklist-gravacao.md); identificar capturas históricas e manter o mesmo ID ao narrar uma execução.

## 1. Abas e links

| Abrir | Link / referência |
|---|---|
| Portal HTTPS | [Oficina homolog](https://8phthn792m.execute-api.us-east-1.amazonaws.com) — sessões separadas de administrador, mecânico e cliente já preparadas no ensaio |
| APIs | [Swagger OS](https://8phthn792m.execute-api.us-east-1.amazonaws.com/api/docs), [OpenAPI Billing](https://8phthn792m.execute-api.us-east-1.amazonaws.com/api/v1/billing/openapi.json), [OpenAPI Production](https://8phthn792m.execute-api.us-east-1.amazonaws.com/api/v1/production/openapi.json) |
| Arquitetura / repositórios | [Diagrama e Saga](../fase4/arquitetura.md), [seis repositórios e proteções](../fase4/publicacao.md) |
| CI do OS | [Push aprovado](https://github.com/christochula/oficina-api/actions/runs/42928478487), fonte af93d83; Quality, Integration, Sonar, Frontend, BDD e Container |
| Deploys Actions | [OS](https://github.com/christochula/oficina-api/actions/runs/42929328275), [Billing](https://github.com/christochula/oficina-billing-service/actions/runs/42928569648), [Production](https://github.com/christochula/oficina-production-service/actions/runs/42928627925) |
| Datadog | [Dashboard homolog](https://app.datadoghq.com/dashboard/u6t-x9c-awx/oficina--operao-e-observabilidade--homolog), [trace dos três serviços, verificado na interface](https://app.datadoghq.com/apm/trace/6af3b4f30000000061b75976960c6fe6) |
| Infraestrutura Datadog | [Agent/apply](https://github.com/christochula/oficina-infra-kubernetes/actions/runs/42929602706), [percentis/apply](https://github.com/christochula/oficina-infra-kubernetes/actions/runs/42932263134) |

## 2. Provas do ensaio

- **OS #2:** `os06a521bf-0d80-49b5-8dd2-1a1c9c961588`, ENTREGUE, R$175, APPROVED e paymentConfirmed=true.
- **Compensação:** Saga `57dccf1d-8f9d-4d2d-93ce-099c823d1264` COMPENSATED por falta de estoque. Após entrada de uma junta, retry `c5469a88-8b2b-4503-a146-e3db319485fd` COMPLETED; depois ocorreram reparo, pagamento e entrega.
- **Pagamento:** consulta canônica confirmou approved, 175 BRL e as identidades TEST esperadas do vendedor e comprador. `live_mode=true` foi o valor observado; não apresentar false nem inferir movimentação financeira apenas por essa flag. Billing registrou verificação por webhook às **11/11 00:43:09.702 UTC**; PaymentConfirmed no OS às **00:43:09.955 UTC**.
- **Observabilidade:** sinais dos três serviços, compensação/recuperação, 7 séries Saga, 6 séries de filas/inboxes e DLQs, e p95 HTTP com 3 séries/pontos reais na amostra de **00:40:38 UTC**. O trace `6af3b4f30000000061b75976960c6fe6` contém os três serviços em **parte do fluxo**; não demonstra cada transição indexada nem toda a Saga em um trace.

No Datadog, selecionar **11/11 00:15–00:50 UTC = 10/11 21:15–21:50 São Paulo**. O Live Search cobre os últimos 15 minutos; fora dessa janela, a busca depende dos spans indexados e dos filtros de retenção. Reconferir a conta e preservar as capturas: [limites e fontes oficiais](../operacao/datadog.md#tags-e-correlação).

Preservar a **OS #1**, entregue em 06/11, como histórico separado. Para repetir ao vivo, usar o [procedimento de nova OS pela interface](nova-os-demonstracao.md); a próxima será #3 se nenhuma outra for criada. Não resetar dados nem pagar novamente a OS já entregue.

## 3. Estoque para a próxima demonstração

Saldos confirmados após o ensaio; reconferir antes de criar a nova OS:

| Filial / peça | Disponível | Reservado | Consumido |
|---|---|---|---|
| São Paulo / FILTRO-DEMO-AWS | 3 | 0 | 2 |
| São Paulo / JUNTA-DEMO-AWS | 0 | 0 | 2 |
| Rio de Janeiro / FILTRO-DEMO-AWS | 3 | 0 | 0 |

O cenário de São Paulo permite orçamento **100 + 50 + 25 = R$175**, falta da junta e compensação. Repor **uma junta pela interface depois da compensação**, na mesma filial, e tentar a preparação novamente. Nenhuma alteração de estoque é necessária antes dessa conferência. Aguardar os ACKs iniciais antes de atribuir; depois aguardar **ATRIBUIDA/responsável correto no admin** antes de abrir pelo mecânico.

## 4. Sessão e fechamento

A sessão Academy iniciada em **10/11 às 20:44** termina em **11/11/2026 às 00:44:36, São Paulo**. Conferir healths/estado antes de gravar; eventual renovação de credenciais e rollout deve ocorrer pelos GitHub Actions, sem execução manual de Terraform/Helm.

Manter os três perfis em sessões separadas. O comprador Mercado Pago TEST já conseguiu entrar e concluir o pagamento do ensaio. O token do cliente dura **5 minutos**: refazer login antes de pagar uma nova OS. Credenciais, documento, tokens e verificações de conta ficam fora da gravação e deste guia.

Participantes: **Matheus Chula e Karina Lage**. RMs e link do vídeo permanecem para preenchimento pelo grupo em [entrega.json](../fase4/entrega.json); exportar vídeo de até 15 minutos e atualizar o PDF pelo [processo de entrega](../fase4/entrega.md).
