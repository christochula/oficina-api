# Testar o fluxo completo pelo navegador

Este ambiente usa os três serviços reais, PostgreSQL, DynamoDB e SQS em LocalStack. O login de cliente é emitido por um adaptador local após consultar o cadastro do OS Service. O checkout é uma simulação: nenhum cartão, conta Mercado Pago ou cobrança real é necessário. A confirmação passa pelo webhook assinado, pela consulta do pagamento no Billing e pela mensageria até o OS Service.

## Iniciar

Pré-requisitos: Docker Desktop em execução, Node.js 22+ e os repositórios `oficina-api`, `oficina-billing-service` e `oficina-production-service` lado a lado. No PowerShell, dentro de `oficina-api`:

```powershell
docker compose -f compose.phase4.yml up -d --build
npm.cmd ci
npm.cmd ci --prefix frontend
node scripts/seed-local-demo.cjs
$env:LOCAL_DEMO_MODE = 'true'
npm.cmd run dev --prefix frontend -- --host 127.0.0.1
```

Aguarde a saúde dos três serviços antes do seed: OS `http://localhost:3000/api/health/ready`, Billing `http://localhost:3001/api/v1/billing/health` e Produção `http://localhost:3002/api/v1/production/health`.

Abra **http://localhost:5173**. O aviso de demonstração confirma que o adaptador local está ativo. `LOCAL_DEMO_MODE` é lido somente pelo servidor de desenvolvimento; não é incluído no build de produção. Se o Vite já estava aberto, reinicie-o com essa variável. O seed pode ser repetido: não redefine senhas, não reinicia OS e não repõe saldos consumidos.

## Acessos fictícios

| Perfil | Identificação | Senha |
|---|---|---|
| Administrador, aba Equipe | `admin@oficina.com` | `Local-only-admin-password-2026` |
| Mecânico, aba Equipe | `mecanico.local@example.com` | `Local-only-mechanic-password` |
| Cliente, aba Cliente | CPF `52998224725` | Sem senha |

Use três abas para manter os perfis abertos ao mesmo tempo, ou saia e entre novamente a cada troca de perfil. Abra cada aba pela URL do portal; as sessões são independentes por aba. Não duplique uma aba já autenticada, pois o navegador pode copiar sua sessão.

## Roteiro

1. **Administrador:** Ordens de serviço → Nova ordem. Escolha o cliente fictício, o veículo `BRA2E19`, filial São Paulo e informe o problema. Crie a OS e anote seu número/URL. Em “Informar mecânico”, pesquise e selecione **Mecânico Local**.
2. **Mecânico:** abra a mesma OS em Minhas ordens. Registre o diagnóstico e gere o orçamento. Para um exemplo simples, inclua um serviço de R$ 100. Para exercitar reserva/consumo, adicione também um material, quantidade 1, R$ 50, usando o ID do filtro retornado pelo seed para a filial escolhida.
3. **Cliente:** entre pelo CPF, abra a OS e aprove o orçamento. Aguarde a preparação da Saga; atualize a página quando necessário.
4. **Mecânico:** após a preparação, inicie a execução. Se incluiu material, registre seu consumo com o mesmo ID e quantidade. Finalize o serviço.
5. **Administrador:** confira “Reparo concluído: aguardando pagamento”. A entrega ainda está bloqueada.
6. **Cliente:** atualize a OS e clique em **Pagar OS**. No checkout local, simule uma recusa para conferir que a entrega continua bloqueada; depois abra **Pagar OS** novamente e simule a aprovação. O checkout retorna automaticamente à OS quando o Billing recebe a notificação; o link de retorno também fica disponível.
7. **Administrador:** atualize a OS. Com pagamento confirmado, registre a entrega. O estado final será `ENTREGUE`.

As mudanças entre serviços são assíncronas e podem levar alguns segundos. O checkout simulado grava preferências, pagamentos e identificação das notificações em `.tmp/mercadopago-demo/state.json`, montado no contêiner. Reiniciar ou recriar somente o simulador preserva os links. Essa pasta é ignorada pelo Git; preserve-a durante os testes.

Se você utilizou a versão antiga, que guardava preferências somente em memória, recupere os links existentes **antes** de recriar o simulador. Com a pilha antiga ainda em execução:

```powershell
node scripts/bootstrap-local-checkouts.cjs
node scripts/bootstrap-local-checkouts.cjs --write
docker compose -f compose.phase4.yml up -d --no-deps --force-recreate mercadopago
```

O primeiro comando só apresenta o diagnóstico; o segundo inicializa o arquivo se ele ainda não existir. A recuperação consulta as APIs dos donos dos dados e mantém ID, referência e valor de cada preferência. Ela não altera OS/Billing, não aprova pagamentos e não envia webhooks. Um arquivo já existente nunca é sobrescrito pelo script. Cobranças sem ID de preferência continuam aguardando reconciliação, sem criar outra cobrança automaticamente.

## Verificação automatizada

Com o ambiente e o portal em modo demonstração já iniciados:

```powershell
npm.cmd exec -- playwright test -c test/phase4/manual-playwright.config.cjs
```

Esse teste usa os formulários de login, abre e processa uma OS pelo portal, interage com o checkout simulado e confirma o bloqueio/liberação da entrega. Os testes BDD continuam disponíveis em `npm.cmd run test:bdd`.

## Parar

Encerre o Vite com Ctrl+C e execute `docker compose -f compose.phase4.yml stop`. Para voltar, use `up -d` e inicie o Vite novamente. Evite `down -v`: ele remove os bancos locais. Nenhum acesso AWS, Datadog, Sonar ou Mercado Pago real é validado por este roteiro.
