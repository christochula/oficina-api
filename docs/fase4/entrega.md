# Evidências e fechamento da entrega

## Verificação técnica

- Executar `npm run test:cov -- --runInBand` em cada microsserviço; os gates devem passar em statements, branches, functions e lines.
- Executar BDD e Playwright no OS Service com o Compose da Fase 4 ativo. Preservar os relatórios do CI como artefatos e registrar os links reais no README.
- Registrar os SHA das três imagens, os três rollouts independentes, os bancos exclusivos e as filas/DLQs.
- Registrar um fluxo concluído e uma Saga compensada usando o mesmo `sagaId`/`correlationId` nos logs dos três serviços.
- Validar pagamento real usando contas de teste Mercado Pago e webhook assinado. O simulador local comprova integração interna, sem substituir essa evidência externa.
- Conferir PR obrigatório e checagens obrigatórias no GitHub; confirmar qualidade Sonar e observabilidade reais após preencher os acessos.

## Vídeo: roteiro de até 15 minutos

| Tempo | Demonstração |
|---|---|
| 0:00-1:30 | Três serviços, seus repositórios e bancos; EKS/SQS/Datadog |
| 1:30-6:30 | Abrir OS no portal, atribuir, diagnosticar, orçar, aprovar e reparar |
| 6:30-8:30 | Cobrança Mercado Pago de teste, pagamento e liberação da entrega |
| 8:30-10:30 | Estoque insuficiente: falha, compensação e reservas liberadas |
| 10:30-12:30 | PR/CI, cobertura, Sonar e deploy de um serviço |
| 12:30-14:30 | Traces/logs/métricas correlacionados, estado persistido e DLQ |
| 14:30-15:00 | Links dos repositórios e encerramento |

## PDF

Preencher `docs/fase4/entrega.json`: cada participante deve ser um objeto `{ "nome": "...", "identificacao": "..." }`; `video_url` recebe o link do YouTube/Vimeo. Depois executar `python scripts/gerar-pdf-fase4.py`. Enquanto esses dados estiverem ausentes, o PDF será explicitamente identificado como rascunho.

Pendências externas só podem ser marcadas como concluídas após execução real: credenciais, deploy AWS, projeto Sonar, pagamento Mercado Pago, Datadog e gravação/publicação do vídeo. Nenhuma captura simulada deve ser apresentada como evidência desses ambientes.
