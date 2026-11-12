# Vídeo da Fase 4 — roteiro de telas (14min30s)

Participantes: **Matheus Chula e Karina Lage**. Limite do vídeo exportado: **15 minutos**. Atualizado para a interface ensaiada em novembro de 2026.

Este é o roteiro canônico de gravação. A [narração](voice-over-video.md) acompanha os mesmos 12 blocos. Antes de gravar na AWS, executar o [ensaio local completo](ensaio-local-fase4.md) sem captura de vídeo e, depois do deploy, repetir o ensaio na AWS. Teste local aprovado não comprova Mercado Pago TEST real, Gateway, EKS, Sonar ou Datadog.

**Cópia privada:** `roteiro-video.local.md` é somente um apoio de acessos, ignorado pelo Git; não é o roteiro de localhost. Credenciais nunca entram em vídeo, PDF ou PR.

## Preparação da tomada

1. Preencher a ficha de execução: ambiente, URL do portal, data/hora de São Paulo, identificador da tomada, SHAs OS/Billing/Production, links CI/deploy e identificadores dos cadastros fictícios. Usar os outputs do deploy novo, sem reaproveitar URLs da conta AWS anterior.
2. Local: **http://localhost:5273**, projeto `oficina-phase4-test-ux`; preservar a demonstração antiga em 5173. AWS: usar **PORTAL_URL**, o endpoint HTTPS publicado e conferido na conta de destino.
3. Abrir quatro perfis de navegador/contextos isolados: **ADMIN**, **CONSULTOR**, **MECÂNICO** e **CLIENTE**. Confirmar o papel no cabeçalho. Abas comuns ou janelas privadas que compartilham armazenamento não garantem isolamento.
4. Fazer login fora da captura. A equipe usa **Equipe → Entrar como equipe**; o titular usa **Cliente → Acompanhar meu veículo**, com CPF fictício. Confirmar a duração efetiva da sessão e renovar antes de aprovação/pagamento se necessário.
5. Preparar o comprador Mercado Pago TEST em sessão isolada do vendedor. Não mostrar senha, documento, token, código de validação ou dados completos do cartão. No ensaio local, usar o simulador identificado como tal.
6. Capturar em **1920×1080**, fonte legível, zoom estável e notificações desativadas. Gravar um clipe por bloco, com alguns segundos estáveis antes/depois. Os horários abaixo são da edição, não duração máxima das operações.
7. Abrir arquitetura renderizada, repositórios, CI/Sonar/deploy e Datadog da execução atual. Não usar os links de runs antigos como prova da versão nova.
8. Consultar o [checklist](checklist-gravacao.md) e a [preparação de nova OS](nova-os-demonstracao.md). Na AWS, seguir o [runbook de nova conta](../operacao/deploy-fase4-nova-conta.md).

### Massa por tomada

Criar cadastros fictícios exclusivos com prefixo `VIDEO-AAAAMMDD-TOMADA`. Não reduzir estoque, consumir peças artificialmente nem resetar bancos para fabricar a falha.

| Dado | Valor |
|---|---|
| Filial | São Paulo / filial-sp |
| Cliente e veículo | Titular fictício e veículo da ficha; buscar por nome/placa |
| Mecânico | Profissional fictício da ficha, ativo |
| Serviço | Revisão da tomada — R$100, quantidade 1 |
| Peça A | Filtro da tomada — R$50, quantidade inicial 1, reservada 0 |
| Peça B | Junta da tomada — R$25, quantidade inicial 0, reservada 0 |
| Orçamento | Serviço 100 + filtro 50 + junta 25 = **R$175** |
| Solicitação inicial | Filtro 1 e junta 1; solicitação não significa reserva |
| Grupo | Revisão preventiva |
| Nota pública | Serviços e materiais apresentados para aprovação do cliente |
| Nota interna | Observação operacional interna da tomada |

Pesquisar peças por **nome, descrição ou código**, com a filial explícita. Selecionar resultados do catálogo. UUID não deve ser transcrito para abrir, orçar ou consumir. Após criar a OS, registrar seu número e URL; ID, Saga e correlação ficam apenas na ficha técnica para conferência.

A mesma OS atravessa os blocos 4–9 e aparece no encerramento. Cada ensaio ou gravação usa uma OS nova; não repetir pagamento de ordem anterior nem remontar uma entregue.

### Evidências técnicas sem expor autenticação

A interface é a evidência principal de negócio. Quando for necessário mostrar campos técnicos, usar somente **Prévia/Resposta** de um GET já feito pelo portal em F12 → Rede, com o painel preparado fora da captura. Não mostrar Headers, armazenamento ou chamadas de login.

Conferir `status`, `sagaId`, `preparacao` (string), `orcamento.total`, `paymentConfirmed` e `pagamento.status`. Comparar Saga compensada e Saga da recuperação. Identificadores de uma nova requisição GET não substituem a correlação da operação.

Na equipe, **Peças desta OS** mostra reserva, consumo e restante da ordem. Esse painel não é o saldo geral de estoque. O cliente não deve receber notas internas, consumo operacional ou detalhes privados de estoque.

## Linha do tempo

| Bloco | Tempo editado | Cena |
|---|---|---|
| 1 | 00:00–00:40 | Projeto e participantes |
| 2 | 00:40–01:40 | Arquitetura, dados e Saga |
| 3 | 01:40–02:20 | Perfis e cenário da nova tomada |
| 4 | 02:20–03:30 | Abertura e atribuição |
| 5 | 03:30–04:45 | Diagnóstico e orçamento |
| 6 | 04:45–06:15 | Aprovação, compensação e encaminhamento |
| 7 | 06:15–07:30 | Reposição e recuperação |
| 8 | 07:30–08:45 | Execução e bloqueio da entrega |
| 9 | 08:45–10:15 | Pagamento e entrega |
| 10 | 10:15–11:55 | Testes, qualidade e deploy |
| 11 | 11:55–14:00 | Logs, traces e métricas |
| 12 | 14:00–14:30 | Resultado e materiais de entrega |

## 1. Apresentação — 01-apresentacao.mp4

Abrir o início do portal com papel legível e o README da versão publicada. Mostrar projeto e participantes; apresentar **três microsserviços de negócio**, com repositórios adicionais de suporte. O repositório de banco legado não corresponde a um terceiro RDS da Fase 4.

**Aceite:** título, participantes e versão/ambiente identificados. No local, não narrar implantação AWS já realizada.

## 2. Arquitetura — 02-arquitetura.mp4

Abrir [arquitetura da Fase 4](../fase4/arquitetura.md), renderizada. Percorrer Portal → Gateway/Auth → OS, Billing e Production; PostgreSQL exclusivo de OS, PostgreSQL exclusivo de Billing e DynamoDB de Production. Mostrar SQS/DLQs, Mercado Pago e Datadog.

Enquadrar a justificativa de Saga orquestrada, preparação e compensação. A compensação mantém a aprovação e a recuperação usa nova Saga. Não sugerir acesso direto ao banco de outro serviço.

**Aceite:** divisão de dados, SQL/NoSQL, comunicação e estratégia explicados. O diagrama representa o destino AWS; identificar os substitutos locais no ensaio.

## 3. Perfis e cenário — 03-cenario.mp4

Mostrar brevemente as quatro sessões com nomes de perfis, sem login ou dados privados. No ADMIN, abrir **Estoque**, pesquisar os códigos da tomada e conferir filial-sp: filtro disponível 1 e junta disponível 0.

Apresentar a ficha pública do cenário: serviço 100, filtro 50, junta 25. Explicar que a falta inicial produzirá a compensação antes do reparo.

**Aceite:** massa nova, valores e falta intencional claros. Nenhuma dependência de OS ou captura da conta antiga.

## 4. Abertura e atribuição — 04-abertura-atribuicao.mp4

1. ADMIN → **Ordens de serviço → Nova ordem**. Escolher São Paulo e cliente cadastrado; buscar por nome e clicar no resultado.
2. Buscar o veículo pela placa e selecionar. Avançar para o problema.
3. Preencher descrição da tomada, selecionar o serviço pelo catálogo e adicionar filtro e junta, **1 unidade de cada**, pelos nomes/códigos.
4. Preencher notas pública/interna da abertura, revisar cliente, veículo, filial e peças. Clicar **Criar ordem** uma vez.
5. Anotar o número real. Recarregar o detalhe e mostrar as duas solicitações preservadas. Não confundir solicitação com reserva.
6. Aguardar **Preparando atendimento** e confirmação dos participantes. Usar **Atualizar andamento** se a atualização automática pausar.
7. **Informar mecânico** → selecionar o profissional da ficha → **Atribuir**. Aguardar responsável e status atribuídos no ADMIN antes de abrir pelo MECÂNICO.

**Aceite:** uma OS criada, escolhas persistidas e acesso efetivo do responsável. Se houver resposta incerta, pesquisar antes de recriar. Se a atribuição ainda não apareceu na lista do mecânico, atualizar a busca; não reatribuir para contornar a propagação.

## 5. Diagnóstico e orçamento — 05-diagnostico-orcamento.mp4

1. MECÂNICO → **Meu trabalho** → localizar a OS pelo número → **Registrar diagnóstico**. Descrever revisão preventiva e substituição de filtro/junta; salvar.
2. **Gerar orçamento**. Preencher **Título do grupo: Revisão preventiva**.
3. Manter a primeira linha como serviço, descrição da revisão, quantidade 1, valor 100. Adicionar duas linhas de material.
4. Em cada material, selecionar **Peça do catálogo** pelo nome/código da filial. Conferir descrição/preço sugeridos: filtro 50 e junta 25, quantidade 1 em ambas.
5. Preencher **Notas visíveis ao cliente** e **Notas internas**. Mostrar os três itens e total **R$175,00**.
6. **Enviar ao cliente** uma vez. No detalhe, conferir grupo, itens, notas e estado **Aguardando aprovação**.

**Aceite:** orçamento persistido e total correto, sem copiar ID. Uma peça ativa sem saldo pode ser orçada; a falta será tratada na preparação.

## 6. Aprovação e compensação — 06-aprovacao-compensacao.mp4

1. CLIENTE → **Minhas ordens** → buscar número da mesma OS → **Orçamento**. Mostrar grupo, três itens, total e nota pública; nota interna deve estar ausente.
2. **Aprovar orçamento** e confirmar uma vez. Aguardar compensação.
3. CONSULTOR → mesma OS. Mostrar falta da junta, código/filial e próximo passo para o administrador. O consultor não recebe acesso ao estoque nem quantidade disponível privada.
4. ADMIN → **Histórico** e detalhe da OS. Mostrar aprovação mantida, preparação compensada e nenhuma reserva remanescente da tentativa.
5. Registrar a Saga compensada na ficha técnica para o bloco 11.

**Aceite:** falha real de estoque antes da execução, compensação concluída, orçamento aprovado preservado e encaminhamento compreensível. Não chamar compensação pendente de concluída.

## 7. Reposição e recuperação — 07-recuperacao.mp4

1. ADMIN, no diagnóstico de falta da OS → **Consultar e repor nesta filial**.
2. Conferir junta e filial-sp na busca contextual. **Dar entrada**, quantidade **1**, confirmar uma única vez.
3. Voltar à mesma OS e **Tentar preparação novamente**. Aguardar preparação concluída.
4. Registrar a nova Saga e comparar com a compensada. Conferir orçamento aprovado R$175 e reservas por peça.

**Aceite:** reposição na entidade/filial corretas; nova Saga, mesma OS; uma unidade reservada de cada material. Se a resposta da entrada for incerta, consultar o saldo antes de repeti-la.

## 8. Execução — 08-execucao.mp4

1. MECÂNICO → mesma OS → **Iniciar execução**.
2. **Consumir peça**: escolher filtro pela identificação legível e registrar 1. Repetir para junta, 1.
3. Mostrar **Peças desta OS**: para cada material, reservada 1, consumida 1, restante 0.
4. **Finalizar serviço**. Aguardar **Aguardando pagamento**.
5. CONSULTOR ou ADMIN: mostrar que **Registrar entrega** ainda não está disponível.

**Aceite:** consumos conciliados e entrega bloqueada. Se a resposta de consumo se perder, seguir a recuperação da operação pendente; não inventar nova operação para repetir um consumo incerto.

## 9. Pagamento e entrega — 09-pagamento-entrega.mp4

1. CLIENTE: renovar login se necessário e abrir a mesma OS. Se aparecer **Preparando pagamento**, aguardar. Clicar **Pagar OS** somente quando disponível.
2. **AWS:** conferir Checkout Pro, comprador/vendedor TEST distintos, cartão TEST, valor R$175 e referência correta. **Local:** mostrar aviso do simulador e clicar **Aprovar pagamento de demonstração**; não narrar esse trecho como Mercado Pago real.
3. Retornar à mesma OS. Aguardar confirmação do Billing e propagação para OS. A URL de retorno sozinha não comprova pagamento.
4. CONSULTOR: aguardar **Pronta para entrega**, clicar **Registrar entrega** e **Confirmar entrega**.
5. Mostrar **Entregue**, **Atendimento concluído**, orçamento e histórico. Conferência técnica: pagamento aprovado e `paymentConfirmed=true`.

**Aceite:** confirmação recebida antes da entrega; mesma OS do começo ao fim. Uma demora não autoriza pagar novamente.

## 10. Testes e deploy — 10-ci-deploy.mp4

Na AWS, mostrar runs reais dos commits implantados: testes/cobertura dos três serviços, gates de qualidade, frontend/BDD/integração e Sonar. Diferenciar métricas Jest de métricas Sonar.

Gravar um deploy automatizado real de pelo menos um serviço, fora do trecho transacional da OS. Mostrar SHA, publicação de imagem, migrações aplicáveis, rollout e healths. A captura pode ser editada, mas não apresentada como execução ao vivo se for um run já concluído. Confirmar proteção efetiva de branches antes de afirmá-la.

No ensaio local, conferir comandos e relatórios locais e preparar a navegação dessas telas. Marcar **DEPENDE DE AWS/CI** o que não foi executado externamente.

**Aceite AWS:** testes, imagem e rollout pertencem à versão demonstrada, sem remover gates para gravar.

## 11. Observabilidade — 11-observabilidade.mp4

1. Datadog: escolher `env:homolog`, período atual da tomada e número/ID técnico da nova OS. Registrar horários em São Paulo e UTC.
2. Logs dos três serviços: localizar falha, cancelamento/liberação, recuperação e confirmação do pagamento. Comparar as duas Sagas.
3. APM: mostrar um trace com os serviços efetivamente presentes ou traces correlacionados. Não prometer que toda a Saga com esperas humanas esteja em um único trace.
4. Dashboard: transições/compensações, latência dos serviços, mensagens/filas/DLQs e taxa de abertura de OS. A taxa OS/s não é contagem absoluta.
5. Aguardar ingestão e preservar capturas atuais. DLQ zero é evidência válida. Gauges de filas exportadas pela aplicação não comprovam integração nativa AWS/Datadog.

No local, usar logs e resultados de conferência como evidência local, mantendo Datadog cloud **pendente**.

**Aceite AWS:** sinais da nova execução, com origem/período identificados. Não substituir dados ausentes por histórico antigo apresentado como atual.

## 12. Encerramento — 12-encerramento.mp4

Mostrar a nova OS entregue e os materiais da Fase 4: arquitetura, estratégia Saga, justificativas, links dos seis repositórios, Swagger/Postman e relatórios. Inserir participantes e RMs confirmados.

Após publicar o vídeo em YouTube/Vimeo público ou não listado, preencher `video_url` e identificações em `docs/fase4/entrega.json`, gerar e revisar o PDF pelo [processo de entrega](../fase4/entrega.md).

**Aceite:** vídeo acessível, até 15 minutos, PDF final e evidências preservadas. Desmontar os recursos AWS somente após verificar esses materiais, conforme o runbook; preservar projetos externos e arquivos de evidência.

## Montagem

Manter cronologia e uma única OS nas cenas de negócio. Cortar autenticação, digitação repetitiva e esperas sem trocar resultados entre ordens. Identificar ambiente, perfil, OS, SHA e período nas legendas. Gravar a narração depois das imagens e remover qualquer afirmação não comprovada. Guardar material bruto, relatório de ensaio e evidências técnicas.

As execuções antigas continuam arquivadas; nenhuma URL, OS, pagamento ou janela de Lab histórica é pré-requisito desta nova gravação.
