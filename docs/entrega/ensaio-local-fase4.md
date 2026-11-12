# Ensaio local da Fase 4 — antes de gravar

Este guia executa os mesmos 12 blocos do [roteiro canônico](roteiro-video.md), **sem gravar vídeo**. Objetivo: validar a narrativa exata pela interface antes do merge, da implantação em outra conta AWS e da gravação final.

## Ambiente e preparação

- Portal atual: **http://localhost:5273**; Docker Compose **oficina-phase4-test-ux**.
- Serviços OS/Billing/Production: 3100/3101/3102; LocalStack: **4666**; simulador de pagamento: **8188**.
- Preservar portal **5173**, projeto de demonstração, bancos e evidências anteriores.
- Não executar `test-clean` nem a suíte genérica `test:local` contra essa pilha compartilhada: ela usa outro projeto/portas e inclui limpeza/reinícios.
- Usar quatro contextos isolados com login normal: administrador, consultor, mecânico e cliente. Acesso fictício fica em arquivo privado de preparação, nunca no relatório público.
- Criar massa exclusiva `VIDEO-AAAAMMDD-TOMADA`: filial-sp, serviço 100, filtro 50 com saldo 1, junta 25 com saldo 0; quantidades 1/1/1, total 175.
- Preparação por APIs dos respectivos donos de dados é permitida; todas as mutações da jornada principal são feitas pelo portal. Conferências técnicas são somente leitura.

Registrar versão dos fontes/imagens antes do ensaio. Enquanto houver alterações não commitadas, usar manifest de hashes e declarar essa condição; não atribuir os testes ao SHA antigo.

Com a pilha isolada já ativa, executar em PowerShell na pasta `oficina-api`:

```powershell
npm.cmd run test:video:local
```

O comando executa a narrativa principal e o caso independente de pagamento recusado/depois aprovado; não inicia, reinicia nem remove containers. Cria uma massa fictícia nova por execução. Capturas e relatórios ficam no diretório ignorado; vídeo, HAR e traces de autenticação ficam desativados. Os cenários complementares abaixo têm evidências próprias e não devem ser presumidos a partir desses dois testes.

## Execução por bloco

| Bloco | Ação local | Resultado esperado / evidência | Diferença AWS |
|---|---|---|---|
| 1 | Abrir início e documentação | Projeto/perfis identificados; captura do portal | Endpoint HTTPS e release implantada |
| 2 | Revisar diagrama/Saga | Divisão de dados e comunicação correspondem ao código | LocalStack/Compose substituem serviços gerenciados/EKS |
| 3 | Conferir quatro sessões e peças da tomada | São Paulo; filtro 1 e junta 0 disponíveis | Cadastros novos na conta de destino |
| 4 | Admin abre com duas peças e atribui mecânico | Uma OS, solicitação persistida após reload e acesso do responsável | Mesma interface via Gateway |
| 5 | Mecânico diagnostica e envia três linhas, grupo e notas | Total R$175; grupo e notas persistidos | Mesma regra |
| 6 | Cliente aprova; consultor acompanha falta | Compensação concluída, aprovação mantida; nota interna oculta e consultor sem estoque | Mensagens/Saga nos serviços AWS |
| 7 | Admin usa link contextual, repõe junta 1 e tenta novamente | Filial correta, nova Saga e reserva 1 de cada peça | SQS/DynamoDB reais |
| 8 | Mecânico inicia, consome filtro/junta e finaliza | Reservada1/consumida1/restante0; entrega indisponível | Mesma regra |
| 9 | Cliente paga no simulador; consultor entrega | Retorno à mesma OS, confirmação e Entregue | Checkout Pro TEST e webhook do Mercado Pago real |
| 10 | Conferir testes, cobertura e navegação prevista | Relatórios locais e identificação da versão | CI/Sonar/imagem/rollout atuais ficam pendentes |
| 11 | Conferir logs e IDs da mesma OS | Falha, duas Sagas, recuperação e pagamento local | Ingestão atual no Datadog fica pendente |
| 12 | Conferir ordem entregue e documentos | Histórico/total preservados; links e campos pendentes identificados | Vídeo publicado, RMs e PDF final após gravação |

Seguir os cliques detalhados do roteiro principal. Anotar número da OS assim que criada; consultar antes de repetir criação, entrada, consumo ou pagamento com resposta incerta.

## Cenários complementares em outras OS

| Caso | Aceite |
|---|---|
| Rejeição | Cancelada com próximo passo claro; sem consumo/reserva/pagamento indevidos |
| Pagamento recusado e depois aprovado | Entrega continua bloqueada na recusa e só libera após confirmação válida |
| Três tentativas sem reposição | Compensações sem acumular reservas ou perder a aprovação |
| Reposição na filial errada | Não resolve a falta da OS; reposição correta permite recuperação |
| Excesso de consumo | Erro definitivo com saldo; nenhuma alteração indevida |
| Resposta perdida após consumo | Recuperação da mesma operação sem consumo duplicado |
| Acesso cruzado | Cliente/mecânico não acessam ordens alheias; consultor não acessa estoque |
| Sessão/rascunho | Retomada da própria conta preserva dados; isolamento e logout funcionam |

Cada caso deve apontar para sua execução e OS. Não somar pilotos com falhas como aprovações. Se for reutilizada uma evidência anterior, identificá-la expressamente como regressão anterior, sem afirmar reexecução atual.

## Diferenças que precisam permanecer explícitas

O pagamento local é um **simulador**, embora implemente retorno e webhook. O login do cliente usa adaptador Vite; a configuração local atual emite sessão de uma hora, enquanto a duração cloud deve ser conferida no deploy. O frontend local é servido por Vite, e a AWS usa os assets da imagem aprovada.

LocalStack não reproduz toda a durabilidade cloud: a versão usada não preservou mensagem SQS pendente em um ensaio de reinício. Não desligar o emulador durante a jornada. Isso não caracteriza comportamento do SQS AWS.

Credenciais, IAM, TLS/Gateway, contas Mercado Pago TEST, Sonar, rollout EKS e Datadog exigem validação externa posterior. Nunca marcar esses itens aprovados apenas pelo ensaio local.

## Registro e decisão de avanço

Salvar em `output/video-readiness/<execucao>/` (ignorado pelo Git): manifest de versão, passos executados, resultado, capturas, consultas sanitizadas, logs e falhas. Classificar cada bloco como **PASS_LOCAL**, **FAIL** ou **AWS_PENDING**; cenas mistas devem separar os critérios.

Avançar quando a mesma OS completar toda a narrativa de R$175 pela interface, com quatro perfis, sem transcrição de UUID para seleção, sem ajuste direto de banco/status e com checks locais aprovados. Corrigir falhas e repetir a jornada principal após mudança de aplicação.

Tempos de Playwright medem automação, não compreensão humana nem duração final editada. A montagem será validada posteriormente, com alvo 14min30s e máximo 15 minutos.

## Resultado de 12/11/2026

Ensaio local aprovado: **OS #98**, R$175, quatro perfis, compensação, reposição, recuperação, execução, pagamento simulado e entrega na mesma OS. O caso de pagamento recusado/depois aprovado passou na OS #104. Também passaram os três testes complementares de preparação/rejeição/consumo, 14 verificações de retomada e duas tentativas de acesso cruzado (HTTP403).

As evidências estão em `output/video-readiness/`: `rehearsal-summary.md` e `rehearsal-consolidated.json` identificam as execuções autoritativas, com capturas e manifest de fontes. A ficha privada de quatro acessos locais está em `2026-11-12T21-00-59-841Z/acessos.local.md`, dentro desse diretório ignorado; permite preparar uma nova OS humana, sem reabrir a OS #98 entregue. Nenhuma credencial está neste documento público.

API672, Billing92, Production112 e frontend148 testes passaram nesta rodada; lint/build e contratos também. BDD e resiliência da reauditoria anterior continuam identificados como evidências anteriores, até a reexecução no CI candidato. A aprovação acima é local: conta AWS, Mercado Pago TEST real, Gateway, EKS, CI/Sonar da nova versão e Datadog seguem pendentes até prova externa.
