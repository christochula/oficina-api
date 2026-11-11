# Checklist de gravação — Fase 4

Conferir na sessão da gravação. O snapshot de 06/11/2026 comprova uma execução anterior; não atesta a disponibilidade atual do Academy ou do Datadog. Nenhum item abaixo foi marcado como validado por este documento.

## Ambiente e evidências

- [ ] Sessão Academy ativa; eventuais renovações de credenciais e rollouts necessários concluídos pelos workflows GitHub Actions.
- [ ] Dois nós EKS Ready e workloads OS/Billing/Production disponíveis em oficina-fase4.
- [ ] Portal HTTPS e assets carregam; healths HTTP200: /api/health/ready, /api/v1/billing/health e /api/v1/production/health.
- [ ] Frontend usa a mesma origem para /auth/token; LOCAL_DEMO_MODE não participa da implantação cloud.
- [ ] CI, cobertura, quality gates e deploy correspondem ao SHA demonstrado. Links dos três serviços preparados; nenhum gate removido para gravar.
- [ ] Métricas, logs e traces dos três serviços chegaram ao Datadog; filtros/período conferidos com tráfego recente e uma correlação relevante já localizada.
- [ ] OS #1 entregue e seu histórico preservados; capturas antigas identificadas como execução de 06/11.

## Ensaio pela interface

- [ ] Admin, mecânico e cliente em sessões separadas e com o perfil correto. Confirmar o acesso antes do cronômetro.
- [ ] Conferir cadastros, IDs e disponibilidade real das peças na filial-sp, conforme [nova OS](nova-os-demonstracao.md). Não resetar dados.
- [ ] Anotar número/ID da nova OS após a criação. Se a resposta demorar, consultar a lista antes de criar novamente.
- [ ] Esperar os dois participantes antes da atribuição; orçamento com três itens e total R$175.
- [ ] Falta de estoque produz compensação; reposição e retry concluem a preparação com nova Saga.
- [ ] Mecânico registra execução/consumos; cobrança somente após reparo; entrega bloqueada até confirmação.
- [ ] Comprador e vendedor Mercado Pago TEST distintos e do mesmo país; cartão TEST preparado. Verificações da conta real ficam com o titular e fora da gravação.
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
