# Narração do vídeo — 14min30s

Gravar a voz depois das imagens, seguindo os mesmos 12 blocos do [roteiro de telas](roteiro-video.md). As citações são falas; títulos e notas não são narrados. Manter somente afirmações comprovadas na execução filmada. A referência é uma nova OS na conta AWS de destino, sem dependência de ordens históricas.

No ensaio local, substituir expressamente a fala do pagamento pela variante indicada e tratar EKS, CI/Sonar e Datadog como verificações posteriores. O vídeo final usa Mercado Pago TEST real e evidências da versão implantada.

## 1. 00:00–00:40 — Apresentação

> Somos Matheus Chula e Karina Lage. Este é o projeto da Fase quatro da Oficina. Vamos acompanhar uma ordem de serviço em quatro perfis: administrador, consultor técnico, mecânico e cliente. Mostramos uma falha de estoque, sua compensação e recuperação, e concluímos reparo, pagamento e entrega. Depois, apresentamos a arquitetura, os testes, o deploy automatizado e os sinais do fluxo distribuído.

Pausa: participantes, ambiente e portal. A arquitetura é detalhada no bloco seguinte.

## 2. 00:40–01:40 — Arquitetura e dados

> A solução tem três microsserviços de negócio. O serviço de ordens mantém o atendimento e coordena a Saga, usando seu PostgreSQL. Billing cuida do orçamento e do pagamento, com outro PostgreSQL. Production concentra diagnóstico, estoque e execução, com DynamoDB. Cada serviço é responsável pelos próprios dados, sem acessar diretamente o banco de outro.
>
> APIs atendem as chamadas imediatas, enquanto comandos e eventos passam por filas SQS e suas filas de mensagens não processadas. A Saga orquestrada coordena a preparação e, quando necessário, a compensação. Os serviços têm imagens e pipelines independentes em um EKS compartilhado. JWT, perfis e vínculo com a ordem controlam o acesso.

Pausa: diagrama, três bancos e sequência de compensação. No local, identificar Compose e LocalStack como substitutos de infraestrutura.

## 3. 01:40–02:20 — Perfis e cenário

> Esta tomada usa cadastros fictícios e uma ordem nova. Em São Paulo, o filtro custa cinquenta reais e tem uma unidade disponível. A junta custa vinte e cinco reais e começa sem estoque. Com o serviço de cem reais, o orçamento será de cento e setenta e cinco reais. A falta da junta vai interromper a preparação antes do reparo e permitir demonstrar a compensação e a recuperação da mesma ordem.

Pausa: perfis, filial e saldos iniciais. Não mostrar credenciais.

## 4. 02:20–03:30 — Abertura e atribuição

> O administrador localiza cliente, veículo e serviço pelos nomes e pela placa. Seleciona também as duas peças solicitadas, com uma unidade de cada, e revisa a filial e o problema informado. A solicitação fica preservada na ordem, mas ainda não representa uma reserva de estoque.
>
> Depois da abertura, Billing e Production confirmam o atendimento. Enquanto essa propagação está pendente, a interface explica a espera. Com os participantes confirmados, o administrador atribui o mecânico. Conferimos o responsável no detalhe e o acesso pela sessão desse profissional antes de prosseguir. Assim, a demonstração acompanha uma única ordem, com escolhas legíveis e autorização vinculada ao atendimento.

Pausa: revisão, peças persistidas, número da OS e responsável.

## 5. 03:30–04:45 — Diagnóstico e orçamento

> O mecânico registra o diagnóstico e monta o orçamento no grupo Revisão preventiva. São três itens: serviço de cem reais, filtro de cinquenta e junta de vinte e cinco. A quantidade é uma unidade de cada, totalizando cento e setenta e cinco reais.
>
> Os materiais são encontrados pelo catálogo da filial, sem transcrever identificadores técnicos. Descrição e preço sugeridos podem ser conferidos antes do envio. O título do grupo e as notas ficam preservados. A nota pública acompanha o orçamento para o cliente; a anotação interna permanece restrita à equipe.
>
> Uma peça ativa pode ser orçada mesmo sem saldo. A decisão do cliente e a preparação distribuída ainda precisam acontecer antes do início físico do reparo.

Pausa: catálogo, três linhas, grupo, total e orçamento persistido.

## 6. 04:45–06:15 — Aprovação e compensação

> O cliente consulta sua própria ordem, confere o grupo, os três itens e a nota pública, e aprova o orçamento. A nota interna não aparece nessa sessão. A aprovação inicia a preparação coordenada pelo serviço de ordens.
>
> O filtro tem saldo, mas a junta não. A preparação falha e a Saga compensa a tentativa: cancela a preparação, libera eventuais reservas e desfaz o congelamento do orçamento. A aprovação do cliente continua registrada e o reparo não começa.
>
> O consultor vê qual peça falta, seu código e a filial responsável. A orientação permite encaminhar a reposição ao administrador, sem conceder ao consultor acesso ao estoque. Conferimos o histórico e o término da compensação antes de avançar. A falha permanece registrada na mesma ordem que vamos recuperar.

Pausa: visão do cliente, faltante do consultor, histórico e reservas liberadas.

## 7. 06:15–07:30 — Reposição e recuperação

> O administrador usa o acesso contextual para consultar a peça na filial correta e registra a entrada de uma junta. Voltamos à mesma ordem e solicitamos outra tentativa de preparação.
>
> A recuperação recebe um novo identificador de Saga, mantendo a referência da tentativa compensada. O orçamento aprovado conserva seus itens e o valor de cento e setenta e cinco reais. Agora os participantes concluem a preparação, e uma unidade de cada material fica reservada para esta ordem.
>
> Não recriamos o atendimento nem apagamos a falha anterior. O histórico permite distinguir o problema, a reposição e a recuperação, enquanto os saldos mostram a reserva correspondente à tentativa bem-sucedida.

Pausa: entrada única, duas Sagas e preparação concluída.

## 8. 07:30–08:45 — Execução e cobrança

> Com a preparação concluída, o mecânico inicia a execução e registra o consumo de uma unidade de cada material. O painel Peças desta OS separa a quantidade reservada, a consumida e o restante. Ao final, cada peça mostra uma unidade consumida e nenhuma restante.
>
> O mecânico finaliza o serviço. A ordem passa para aguardando pagamento, mas a entrega continua bloqueada. A aplicação também informa enquanto a cobrança está sendo preparada.
>
> Esse ponto separa a compensação anterior ao reparo da cobrança por um trabalho já executado. A sequência permanece aprovação, preparação, execução, pagamento e entrega, sem devolver artificialmente ao estoque peças já consumidas.

Pausa: painel de saldos, conclusão do reparo e bloqueio da entrega.

## 9. 08:45–10:15 — Pagamento e entrega

**Variante do vídeo AWS:**

> Quando o checkout está disponível, o cliente segue para o Checkout Pro do Mercado Pago. Utilizamos comprador e vendedor de teste distintos e cartão de teste. O valor corresponde ao orçamento da ordem acompanhada.
>
> O retorno do navegador não confirma o pagamento sozinho. Billing valida a assinatura do webhook e consulta o pagamento no provedor, conferindo a referência, o valor e a moeda. A confirmação é publicada para o serviço de ordens.
>
> De volta à mesma ordem, aguardamos a confirmação e o estado pronta para entrega. Só então o consultor registra a retirada. A ordem termina entregue, com atendimento concluído e histórico preservado. Não é necessário pagar outra vez apenas porque a propagação ainda está em andamento.

**Substituição para o ensaio local, sem gravação:**

> Neste ambiente, o checkout é um simulador local. Ele exercita aprovação, retorno, webhook e propagação interna. Esse resultado não substitui a validação posterior com contas Mercado Pago TEST no ambiente AWS.

Pausa: checkout, mesma OS no retorno, pagamento confirmado e entrega. Não afirmar resultados antes de observá-los.

## 10. 10:15–11:55 — Testes, qualidade e deploy

> Estes são os pipelines das versões implantadas. Os serviços têm testes e cobertura, e o serviço de ordens inclui verificações de qualidade, integração, Sonar, frontend, BDD e container. Os relatórios apresentados correspondem aos commits identificados; as métricas locais de cobertura e as métricas do Sonar são fontes distintas.
>
> O deploy automatizado publica a imagem e atualiza o serviço no Kubernetes. Mostramos o SHA, as etapas aplicáveis de migração e o resultado do rollout, além dos healths dos serviços.
>
> A execução foi capturada fora da transação da ordem. Os testes e a implantação são evidências reais dessa versão, e não resultados simulados ou obtidos removendo verificações para a apresentação.

Pausa: cobertura, quality gate, SHA, imagem e rollout. Se mostrar run concluído, identificá-lo. Só afirmar percentuais ou proteção de branch efetivamente conferidos.

## 11. 11:55–14:00 — Logs, traces e métricas

> No Datadog, selecionamos o ambiente, o período desta tomada e os identificadores da ordem acompanhada. Nos logs dos três serviços, procuramos a falha de preparação, a compensação, a recuperação e a confirmação do pagamento. Os identificadores das duas Sagas permitem separar as tentativas sem perder o vínculo com a mesma ordem.
>
> Os traces mostram os trechos distribuídos efetivamente capturados. A Saga inclui esperas humanas e não precisa aparecer inteira em um único trace. Quando os trechos estão separados, usamos os atributos de correlação para acompanhá-los.
>
> O dashboard reúne transições da Saga, latência dos serviços e processamento de mensagens. Os percentis descrevem o tráfego observado nessa janela. A taxa de abertura de ordens é apresentada por segundo, sem confundi-la com uma contagem absoluta.
>
> As contagens aproximadas de filas e mensagens não processadas são exportadas pela aplicação. Uma DLQ em zero é um resultado válido. A presença desses indicadores não significa que a integração nativa entre Datadog e serviços AWS esteja habilitada.

Pausa: logs, traces e métricas atuais. Ajustar a fala ao que realmente foi ingerido; não usar dados da conta antiga como evidência da nova OS.

## 12. 14:00–14:30 — Encerramento

> Acompanhamos uma ordem com falha, compensação, recuperação, execução, pagamento e entrega. Os três microsserviços preservam seus próprios dados, com testes, implantação automatizada e observabilidade. A documentação reúne arquitetura, estratégia da Saga, tecnologias, repositórios e evidências. Somos Matheus Chula e Karina Lage. Obrigado por acompanhar.

Pausa: OS entregue e materiais de entrega. Preencher RMs e endereço do vídeo com valores confirmados.

## Ritmo e revisão

Os intervalos reservam **14min30s no total**. São limites de edição por bloco, não tempos máximos de provisionamento, propagação ou execução humana. Gravar a narração por bloco depois de montar as imagens; distribuir pausas para que status, totais, saldos e resultados possam ser lidos.

Conferir a duração real do arquivo exportado, que deve ficar em **até 15 minutos**. Se faltar espaço, reduzir falas repetidas e navegação, preservando as provas obrigatórias. Não acelerar uma tela a ponto de tornar a evidência ilegível.
