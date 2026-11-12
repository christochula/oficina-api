# Desenvolvimento e testes locais da Fase 4

Para o ensaio da nova gravação, seguir [ensaio-local-fase4.md](entrega/ensaio-local-fase4.md): a instância validada está em **5273**, projeto **oficina-phase4-test-ux**, LocalStack **4666**. A demonstração em 5173 foi preservada na versão anterior. Os comandos gerais abaixo descrevem as pilhas padrão e não devem substituir, limpar ou reconstruir essas instâncias durante o ensaio.

Os três microsserviços usam seus bancos e mensagens reais em containers. O provedor Mercado Pago é um simulador local com checkout visível, webhook assinado e consulta de pagamento pelo Billing. O login de cliente usa o adaptador local do Vite. AWS, contas Mercado Pago e credenciais cloud não são necessários.

## Iniciar a demonstração

Pré-requisitos: Docker Desktop em execução, Node.js 22 com npm e os repositórios `oficina-api`, `oficina-billing-service` e `oficina-production-service` lado a lado. Abra PowerShell em `oficina-api`:

```powershell
npm.cmd ci
npm.cmd ci --prefix frontend
npm.cmd run local:up
npm.cmd run local:dev
```

`local:up` constrói as imagens, espera a saúde de OS, Billing, Production e checkout, e cria os cadastros fictícios. O seed pode ser repetido: não redefine senhas, não repõe estoque consumido e não altera OS existentes.

Abra **http://localhost:5173**. O aviso de demonstração deve estar visível. O portal usa a versão atual do código via Vite; mudanças de backend precisam de `local:up` para reconstruir a imagem.

| Perfil | Usuário | Senha de demonstração local |
|---|---|---|
| Administrador | `admin@oficina.com` | `Local-only-admin-password-2026` |
| Mecânico | `mecanico.local@example.com` | `Local-only-mechanic-password` |
| Cliente | CPF fictício `52998224725` | Não utiliza senha |

Esses valores são exclusivos da stack local. Os acessos da AWS são diferentes. Use abas abertas separadamente para cada perfil; não duplique uma aba autenticada.

## Isolamento dos testes

| Componente | Demonstração | Testes |
|---|---|---|
| Projeto Docker Compose | `oficina-phase4-demo` | `oficina-phase4-test-local` |
| Portal | `http://localhost:5173` | `http://localhost:5273` |
| OS | `http://localhost:3000` | `http://localhost:3100` |
| Billing | `http://localhost:3001` | `http://localhost:3101` |
| Production | `http://localhost:3002` | `http://localhost:3102` |
| LocalStack | `http://localhost:4566` | `http://localhost:4567` |
| Checkout simulado | `http://localhost:8088` | `http://localhost:8188` |

Os projetos têm redes e volumes separados. A pilha antiga chamada `oficina-phase4`, se existir, não é migrada nem apagada automaticamente. Não inicie a pilha antiga nas portas da demonstração.

Para executar a aceitação completa em um ambiente descartável:

```powershell
npm.cmd exec -- playwright install chromium
npm.cmd run test:local
```

O runner sobe a pilha de testes, executa BDD, o smoke do portal, os fluxos completos nas resoluções desktop e a resiliência com reinícios controlados, salva os logs e remove **somente** o projeto de testes. O código recusa cleanup no projeto da demonstração. Não execute essa suíte enquanto outro processo estiver usando o mesmo projeto de testes.

Para investigar uma falha mantendo os containers:

```powershell
node scripts/local-phase4.cjs test-up
node scripts/local-phase4.cjs test-dev
```

`test-env` apresenta as URLs e variáveis públicas para executar uma suíte individual contra as portas de testes. O runner passa essas variáveis automaticamente durante `test:local`. A limpeza manual desse ambiente é `node scripts/local-phase4.cjs test-clean`; ela nunca aceita o projeto de demonstração.

No CI, `scripts/ci-phase4.sh` cria um projeto `oficina-phase4-ci-<run>-<attempt>-<suite>`, mantendo a limpeza restrita à execução correspondente. As mesmas verificações usam imagens Node 22.

## Pausar e retomar

Encerre o Vite com Ctrl+C e use:

```powershell
npm.cmd run local:stop
```

Esse comando para aplicações, bancos e checkout, mas mantém o LocalStack ativo. PostgreSQL e checkout usam volumes nomeados; o LocalStack possui seu volume e persistência habilitada. Na imagem `localstack/localstack:4.10` usada aqui, o teste de reinício preservou DynamoDB, mas **não preservou uma fila SQS com mensagem pendente**. Por isso, o comando de pausa mantém esse emulador em execução. Não encerre Docker Desktop durante um fluxo com mensagens pendentes; essa operação não oferece a mesma durabilidade do SQS na AWS.

Para retomar, execute `npm.cmd run local:up` e `npm.cmd run local:dev`. Use `npm.cmd run local:status` para conferir os containers. Não use `down -v` na demonstração.

## O que esta validação comprova

As suítes exercitam UI, serviços, consistência dos bancos, outbox/inbox, filas, compensação, retentativas, pagamento simulado e bloqueio de entrega. O ensaio deve incluir repetidas tentativas sem peças, reposição e recuperação da mesma OS; nenhum teste deve consertar a OS por SQL ou alterar seu status diretamente no banco.

Mercado Pago TEST real, Gateway, deploy EKS e Datadog são verificações posteriores, feitas quando o Lab for retomado. O roteiro de gravação continua usando o checkout TEST real na AWS; o checkout local é identificado como demonstração.

Consulte também o [relatório de validação de 11/11/2026](frontend/validacao-local-2026-11-11.md), com resultados, evidências e ordem de publicação dos serviços.
