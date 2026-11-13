# Checklist da nova gravação — Fase 4

Usar o [roteiro canônico](roteiro-video.md). Referências históricas não comprovam a disponibilidade ou a versão atual.

## Antes do merge e do deploy

- [ ] [Ensaio local](ensaio-local-fase4.md) completo em5273, sem gravação; mesma OS de R$175, quatro perfis e compensação/recuperação.
- [ ] Fontes da versão candidata identificados; testes locais e contratos/documentação atualizados.
- [ ] CI testa commits correspondentes de OS, Billing e Production; nenhum gate removido.
- [ ] Deploy automático suspenso antes dos merges para não publicar na conta antiga.
- [ ] Conta/lab da Karina, saldo e permissões conferidos; planos de nova conta revisados.
- [ ] Manifesto do deploy preenchido sem segredos; bucket/keys próprios e nenhuma aplicação dos states AWS antigos.

## Antes da captura AWS

- [ ] Ensaio completo na AWS aprovado, com base fictícia nova e Mercado Pago TEST real.
- [ ] Portal HTTPS, assets e três healths respondem; imagens/rollouts correspondem aos SHAs aprovados.
- [ ] Auth usa Lambda/Gateway, sem adaptador de demonstração local.
- [ ] Sessão AWS e credenciais de runtime válidas por toda a janela; renovação inclui redeploy quando necessária.
- [ ] CI/Sonar, deploy automatizado e documentação abertos nos runs/commits atuais.
- [ ] Datadog recebeu sinais atuais dos três serviços; período e identificação da OS anotados.
- [ ] Massa exclusiva para a gravação: filtro1/junta0 na filial-sp; serviço100 + materiais50/25.
- [ ] Quatro sessões isoladas e autenticadas; comprador/vendedor Mercado Pago TEST distintos.
- [ ] Nova OS será criada durante a tomada. Nenhuma ordem previamente paga será paga novamente.

## Durante os 12 blocos

- [ ] Número da OS anotado após a criação; abertura e atribuição aguardam confirmação efetiva.
- [ ] Seleção por nome/placa/código, sem transcrição de UUID para operar.
- [ ] Solicitações de peças, grupo e notas preservados; nota interna ausente no cliente.
- [ ] Falta apresentada ao consultor sem acesso ao estoque.
- [ ] Compensação concluída antes da reposição; recuperação usa nova Saga e a mesma OS.
- [ ] Entrada e consumo únicos; saldos por OS conciliados; entrega bloqueada antes do pagamento.
- [ ] Aguardar checkout disponível; retorno à mesma OS e confirmação real antes da entrega.
- [ ] Histórico, logs/traces/métricas pertencem à execução indicada.
- [ ] Deploy capturado fora do trecho transacional, com versão aprovada e resultado real.

## Publicação e encerramento

- [ ] Captura em1080p legível; sem senhas, documentos reais, tokens ou notificações pessoais.
- [ ] Vídeo revisado, cronologia correta, até15min; áudio condiz com evidências.
- [ ] YouTube/Vimeo público ou não listado, acessível sem autorização adicional.
- [ ] RMs e video_url preenchidos; PDF gerado e visualmente revisado.
- [ ] Material bruto, relatórios, capturas e referências preservados.
- [ ] Após validar os materiais, desmontar recursos AWS e verificar resíduos/custos pelo runbook.
- [ ] Preservar contas/projetos GitHub, Mercado Pago, Sonar e Datadog.
