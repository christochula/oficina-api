# Checklist de gravação — Fase 4

O ensaio de **10/11/2026** concluiu a OS #2 **ENTREGUE, R$175, APPROVED/paymentConfirmed=true**, com compensação, recuperação e sinais reais no Datadog. O [guia pronto para gravar](pronto-para-gravar.md) reúne as provas e links. Os itens abaixo são conferências para a sessão da gravação; a execução anterior não garante disponibilidade futura.

## Ambiente e evidências

- [ ] Sessão Academy ativa; a sessão iniciada em 10/11 às 20:44 termina em **11/11/2026 00:44:36 São Paulo**. Eventuais renovações/rollouts devem ser concluídos pelos workflows GitHub Actions.
- [ ] Dois nós EKS Ready e workloads OS/Billing/Production disponíveis em oficina-fase4.
- [ ] Portal HTTPS e assets carregam; healths HTTP200: /api/health/ready, /api/v1/billing/health e /api/v1/production/health.
- [ ] Frontend usa a mesma origem para /auth/token; LOCAL_DEMO_MODE não participa da implantação cloud.
- [ ] CI, cobertura, quality gates e deploy correspondem ao SHA demonstrado. Links dos três serviços preparados; nenhum gate removido para gravar.
- [ ] Dashboard e trace preparados na janela do ensaio da OS #2; conferir Live/Indexed e retenção antes da captura. Há prova de um trace com os três serviços em parte do fluxo, sem garantia de toda transição indexada.
- [ ] OS #2 e seu histórico de 10/11 preservados; OS #1 permanece como histórico separado de 06/11. Se houver nova OS, anotar seu ID e manter as execuções identificadas.

## Ensaio pela interface

- [ ] Admin, mecânico e cliente em sessões separadas e com o perfil correto. Confirmar o acesso antes do cronômetro.
- [ ] Conferir cadastros, IDs e disponibilidade real das peças na filial-sp, conforme [nova OS](nova-os-demonstracao.md). Não resetar dados.
- [ ] Anotar número/ID da nova OS após a criação. Se a resposta demorar, consultar a lista antes de criar novamente.
- [ ] Esperar os dois participantes antes da atribuição; orçamento com três itens e total R$175.
- [ ] Depois de atribuir, esperar o administrador mostrar ATRIBUIDA e o responsável correto antes de mudar para o mecânico. Um 403 durante a atualização assíncrona exige reconsulta, não nova atribuição ou mudança de autorização.
- [ ] Falta de estoque produz compensação; reposição e retry concluem a preparação com nova Saga.
- [ ] Mecânico registra execução/consumos; cobrança somente após reparo; entrega bloqueada até confirmação.
- [ ] Comprador e vendedor Mercado Pago TEST distintos e do mesmo país; cartão TEST preparado. Verificações da conta real ficam com o titular e fora da gravação.
- [ ] Refazer login do cliente antes do trecho de pagamento: o token dura 5 minutos. Conferir a sessão isolada do comprador TEST, sem mostrar credenciais ou documento.
- [ ] Retorno do checkout preserva a OS; pagamento aprovado, confirmação e liberação da entrega aparecem na aplicação.
- [ ] Anotar osId, Saga compensada, Saga de recuperação e correlações para o Datadog, sem copiar tokens/headers de autenticação.

## Captura e publicação

- [ ] Áudio testado, fonte legível, zoom estável e notificações pessoais fechadas. Abas prontas sem Secrets, .env, state ou bearer visível.
- [ ] Ensaio ≤14min30s; arquivo exportado ≤15min. Cortes preservam cronologia e ID; dados locais simulados não são usados como prova de ambientes externos.
- [ ] Revisar o vídeo inteiro: legibilidade, som e ausência de credenciais/dados pessoais reais.
- [ ] Manter Matheus Chula e Karina Lage e preencher os RMs em [entrega.json](../fase4/entrega.json).
- [ ] Publicar no YouTube/Vimeo, preencher video_url e verificar acesso sem permissões extras.
- [ ] Gerar/revisar o PDF pelo processo de [entrega Fase 4](../fase4/entrega.md): seis repositórios, vídeo, diagrama, divisão dos dados e justificativa da Saga.

RMs e URL do vídeo podem continuar pendentes durante o ensaio, mas devem ser preenchidos para fechar a entrega.
