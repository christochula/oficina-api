# Nova OS de demonstração, preservando o histórico

Procedimento pelo **portal cloud**, sem executar ações por este documento. Preserve a OS #1 entregue. Não use seed local na AWS, SQL/DynamoDB direto, limpeza de filas, reset de banco ou injeção de sessão.

## 1. Conferir cadastros existentes

O administrador deve localizar primeiro os registros fictícios utilizados em 06/11 e confirmar que estão ativos. Não criar duplicatas apenas para repetir o ensaio.

| Cadastro | Referência para busca |
|---|---|
| Cliente | Cliente fictício Demo AWS; usar o CPF fictício preparado para o grupo no login |
| Veículo | Placa BRA2E19 |
| Mecânico | Mecânico Demo AWS; mecanico.demo@example.com |
| Serviço | Revisão Demo AWS |
| Peça A | FILTRO-DEMO-AWS, R$50 |
| Peça B | JUNTA-DEMO-AWS, R$25 |
| Filial | filial-sp / São Paulo |

Anotar os **IDs das peças** mostrados no cadastro/estoque: o orçamento exige ID, não código textual. Cliente e mecânico precisam ser selecionados nos resultados reais da busca; digitar o nome não confirma a seleção.

## 2. Falta de estoque sem desfazer operações anteriores

Em **Estoque**, consultar a mesma filial. A peça A precisa de pelo menos **1 unidade disponível**. A peça B deve começar com **0 unidades disponíveis e sem reservas de outra OS**. Não presumir os saldos de 06/11: ensaios e ordens novas podem tê-los alterado.

Se a tela não permitir confirmar a ausência de reservas, preferir uma peça B nova com quantidade inicial zero, como descrito abaixo.

- Peça A insuficiente: administrador usa **Dar entrada no estoque** para acrescentar o necessário e registra essa preparação.
- Peça B sem saldo e sem reservas: reutilizar o cadastro existente.
- Peça B com saldo/reservas: preservá-la. Em **Cadastrar peça**, criar uma peça fictícia com código único, por exemplo JUNTA-VIDEO-AAAAMMDD-01, filial-sp, preço R$25 e **Quantidade inicial 0**; usar o novo ID no orçamento.
- Se precisar isolar também a peça A: cadastrar FILTRO-VIDEO-AAAAMMDD-01, preço R$50, quantidade inicial suficiente. Pesquisar o código antes de criar.

Não reduzir saldo diretamente nem registrar consumo fictício para forçar a falha. A recuperação será uma entrada de **1 unidade da peça B**, pela interface, depois de comprovar a compensação.

## 3. Criar uma única OS

1. Administrador: **Ordens de serviço → Nova ordem**. Selecionar o cliente existente na busca.
2. Escolher São Paulo e o veículo BRA2E19. Problema identificável: “Demonstração Fase 4 — AAAAMMDD — revisão e troca de filtro/junta”. Opcionalmente selecionar o serviço de catálogo existente.
3. Revisar e clicar **Criar ordem uma vez**. Anotar número e URL/ID imediatamente.
4. Se houver timeout/erro visual, consultar a lista antes de repetir. Se a OS já existe, continuar pela sua URL.
5. Aguardar **Preparando atendimento** terminar. A atribuição depende da confirmação dos dois serviços. Após o limite da espera automática, usar **Atualizar andamento**; resolver falhas de serviço antes de avançar.
6. **Informar mecânico**: buscar e selecionar Mecânico Demo AWS; confirmar **Atribuir**. Abrir a mesma OS no perfil do mecânico.

## 4. Diagnóstico, orçamento e compensação

Mecânico: **Registrar diagnóstico → Salvar diagnóstico → Gerar orçamento**. Usar **Adicionar item** para três editores:

| Tipo | Descrição | Quantidade | Valor unitário em reais | ID da peça |
|---|---|---|---|---|
| Serviço | Revisão Demo AWS | 1 | 100 | vazio |
| Material | Filtro Demo AWS | 1 | 50 | ID da peça A escolhida |
| Material | Junta Demo AWS | 1 | 25 | ID da peça B escolhida |

Conferir **R$175,00** e clicar **Enviar ao cliente**. Aguardar AGUARDANDO_APROVACAO.

1. Cliente titular abre a mesma OS e aprova. Aguardar a preparação; não iniciar reparo durante a pendência.
2. Mostrar a falha por falta de estoque e Saga **COMPENSATED** no histórico/observabilidade. A OS permanece aprovada. Conferir que as reservas anteriores foram liberadas antes de chamar o rollback de concluído.
3. Admin: na **mesma peça B e filial**, **Dar entrada no estoque**, quantidade 1. Confirmar uma vez; se a resposta for incerta, consultar o saldo antes de repetir.
4. Na OS, **Tentar preparação novamente**, uma vez. Aguardar COMPLETED e anotar a **nova sagaId**, preservando a referência à anterior e o orçamento aprovado.

## 5. Reparo, pagamento e entrega

1. Mecânico: **Iniciar execução**. Em **Consumir peça**, registrar 1 unidade de A e 1 de B, cada consumo uma vez. Se houver dúvida na resposta, consultar histórico/saldo antes de repetir.
2. **Finalizar serviço**; aguardar AGUARDANDO_PAGAMENTO e mostrar que a entrega ainda está bloqueada.
3. Cliente: **Pagar OS**, concluir no Checkout Pro com comprador/cartão TEST preparados. Não mudar para conta/cartão real nem repetir pagamento por demora no retorno.
4. Voltar à mesma OS. Com pagamento APPROVED, paymentConfirmed=true e PRONTA_PARA_ENTREGA, o administrador confirma a entrega.
5. Registrar ENTREGUE, total, histórico e IDs de Saga/correlação. Preservar a OS para consultas posteriores.

Cada ensaio consome estoque e pode criar outra preferência/pagamento. Antes do próximo, consultar ordens e saldos, reutilizar cadastros e criar apenas a nova OS necessária. Não reposicionar uma ordem entregue nem apagar evidências.

Seguir o [roteiro de 14min30s](roteiro-video.md). Se optar por mostrar apenas a execução já concluída da OS #1, apresentar explicitamente o histórico de 06/11 e suas capturas, sem usá-las como etapas ocultas de outra OS.
