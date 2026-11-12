# Evidências e fechamento da entrega

## Verificação técnica

- Executar `npm run test:cov -- --runInBand` em cada microsserviço; os gates devem passar em statements, branches, functions e lines.
- Executar BDD e Playwright no OS Service com o Compose da Fase 4 ativo. Preservar os relatórios do CI como artefatos e registrar os links reais no README.
- Registrar os SHA das três imagens, os três rollouts independentes, os bancos exclusivos e as filas/DLQs.
- Registrar o `osId` e, em cada tentativa, seus `sagaId`/`correlationId` nos logs dos três serviços. A tentativa compensada e a recuperação têm Sagas distintas.
- Validar o fluxo no Mercado Pago usando contas TEST e webhook assinado. O simulador local comprova integração interna, sem substituir essa evidência externa. O snapshot de 06/11/2026 e seus links estão no [README](../../README.md#homologação-e-evidências-da-fase-4); disponibilidade atual deve ser reconferida.
- Conferir PR obrigatório e checagens obrigatórias no GitHub; confirmar qualidade Sonar e observabilidade reais após preencher os acessos.

## Vídeo: roteiro de até 15 minutos

Usar o [roteiro canônico de 14min30s](../entrega/roteiro-video.md), o [checklist da sessão de gravação](../entrega/checklist-gravacao.md) e o [procedimento para nova OS sem reset](../entrega/nova-os-demonstracao.md).

Antes da gravação, executar o [ensaio local da narrativa](../entrega/ensaio-local-fase4.md) e depois repetir o ensaio na AWS. O roteiro cria uma nova OS de R$175 com quatro perfis, compensação **antes** da execução, reposição, recuperação, reparo, pagamento e entrega. Usa busca por nomes/códigos, peças solicitadas, grupo/notas e saldos por OS. São três microsserviços de negócio e seis repositórios; o banco legado não precisa ser provisionado na Fase 4. As evidências antigas são preservadas, mas não são pré-requisito nem substituem a nova execução.

## PDF

Preencher `docs/fase4/entrega.json`: cada participante deve ser um objeto `{ "nome": "...", "identificacao": "..." }`; `video_url` recebe o link do YouTube/Vimeo. Depois executar `python scripts/gerar-pdf-fase4.py`. Enquanto esses dados estiverem ausentes, o PDF será explicitamente identificado como rascunho.

Pendências externas só podem ser marcadas como concluídas após execução real: credenciais, deploy AWS, projeto Sonar, pagamento Mercado Pago, Datadog e gravação/publicação do vídeo. Nenhuma captura simulada deve ser apresentada como evidência desses ambientes.
