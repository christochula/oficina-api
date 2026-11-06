const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { request: fixtureRequest } = require('./support.cjs');

// Prerequisite: scripts/seed-local-demo.cjs, LOCAL_DEMO_MODE=true and the local MP stub.
// The only API writes below create a unique catalog/stock fixture. Every OS transition,
// all three logins and payment approval are submitted through the visible browser UI.
// There is no session injection, JWT minting, route mocking or helper payment callback.
const portalUrl = process.env.MANUAL_PORTAL_URL || 'http://localhost:5173';
const adminEmail = process.env.DEMO_ADMIN_EMAIL || 'admin@oficina.com';
const adminPassword = process.env.DEMO_ADMIN_PASSWORD || 'Local-only-admin-password-2026';
const mechanicEmail = process.env.DEMO_MECHANIC_EMAIL || 'mecanico.local@example.com';
const mechanicPassword = process.env.DEMO_MECHANIC_PASSWORD || 'Local-only-mechanic-password';
const mechanicName = process.env.DEMO_MECHANIC_NAME || 'Mecânico Local';
const clientCpf = process.env.DEMO_CLIENT_CPF || '52998224725';
const vehiclePlate = process.env.DEMO_VEHICLE_PLATE || 'BRA2E19';
const decode = (payload) => payload?.data ?? payload;
const recordId = (record) => typeof record.id === 'string' ? record.id : record.id.valor;
const pathOf = (response) => new URL(response.url()).pathname;

function waitForMutation(page, method, matches) {
  return page.waitForResponse((response) => response.request().method() === method && matches(pathOf(response)), { timeout: 20000 });
}

async function submitAndCheck(page, method, matches, action, readBody = true) {
  const pending = waitForMutation(page, method, matches);
  await action();
  const response = await pending;
  expect(response.ok(), `${method} ${pathOf(response)} returned ${response.status()}`).toBeTruthy();
  return readBody ? decode(await response.json()) : undefined;
}

async function loginOperator(page, email, password) {
  await page.goto(`${portalUrl}/#/login`);
  await expect(page.locator('[data-local-demo]')).toBeVisible();
  await page.getByRole('tab', { name: 'Equipe', exact: true }).click();
  await page.locator('#operator-email').fill(email);
  await page.locator('#operator-password').fill(password);
  const result = await submitAndCheck(page, 'POST', (path) => path.endsWith('/auth/login'), () => page.getByRole('button', { name: 'Entrar como equipe', exact: true }).click());
  await expect(page).not.toHaveURL(/#\/login\/?$/);
  expect(result.accessToken).toBeTruthy();
  return result;
}

async function refreshOrderUntil(page, rolePath, predicate, label) {
  let snapshot;
  await expect(async () => {
    let navigationStarted = false;
    let navigationCommitted = false;
    const freshRequests = new WeakSet();
    const onNavigation = (frame) => {
      if (navigationStarted && frame === page.mainFrame()) navigationCommitted = true;
    };
    const onRequest = (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigationStarted = true;
      if (navigationCommitted && request.method() === 'GET' && pathOf(request).endsWith(rolePath)) freshRequests.add(request);
    };
    page.on('request', onRequest);
    page.on('framenavigated', onNavigation);
    // Ignore an in-flight request from the redirect page. Its body may become
    // unavailable when reload commits, even if its response arrives afterwards.
    const pending = page.waitForResponse((response) => freshRequests.has(response.request()), { timeout: 12000 }).then(async (response) => {
      expect(response.ok(), `Order refresh: ${response.status()}`).toBeTruthy();
      return decode(await response.json());
    });
    pending.catch(() => {}); // A failed reload must not leave an unhandled waiter.
    try {
      await page.reload();
      snapshot = await pending;
      expect(predicate(snapshot), label).toBeTruthy();
      await expect(page.locator('#next-action-title')).toBeVisible();
    } finally {
      page.off('request', onRequest);
      page.off('framenavigated', onNavigation);
    }
  }).toPass({ timeout: 75000, intervals: [1000, 2000] });
  return snapshot;
}

async function confirmOrderAction(page, id, triggerLabel, confirmLabel, suffix) {
  await page.getByRole('button', { name: triggerLabel, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return submitAndCheck(page, 'PATCH', (path) => path.endsWith(`/ordens-servico/${id}/${suffix}`), () => dialog.getByRole('button', { name: confirmLabel, exact: true }).click());
}

test('formulários reais: recepção, diagnóstico, aprovação por CPF, execução, checkout simulado e entrega', async ({ browser }, testInfo) => {
  const actors = [];
  const evidence = { authentication: [], orderTransitions: [], payment: 'pending', browserErrors: [] };
  const makeActor = async (name) => {
    const context = await browser.newContext({ baseURL: portalUrl });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') evidence.browserErrors.push({ actor: name, text: message.text() });
    });
    page.on('requestfailed', (failed) => {
      const target = new URL(failed.url());
      evidence.browserErrors.push({ actor: name, method: failed.method(), url: `${target.origin}${target.pathname}`, reason: failed.failure()?.errorText });
    });
    actors.push({ name, context, page });
    return page;
  };
  const capture = async (page, name) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
    await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
    const visualName = name.startsWith('03-') ? 'local-demo-checkout.png' : name.startsWith('05-') ? 'local-demo-delivered.png' : undefined;
    if (visualName) {
      const destination = path.resolve(__dirname, '../../../.tmp/local-demo');
      await fs.mkdir(destination, { recursive: true });
      await fs.writeFile(path.join(destination, visualName), screenshot);
    }
  };
  let orderId;
  let completed = false;
  try {
    const admin = await makeActor('administrador');
    let adminTokens;
    let client;
    let vehicle;
    const pecaId = `manual-${randomUUID()}`;

    await test.step('Administrador entra pelo formulário e prepara somente os cadastros de teste', async () => {
      adminTokens = await loginOperator(admin, adminEmail, adminPassword);
      evidence.authentication.push('ADMINISTRADOR: POST /api/v1/auth/login via form');
      client = await fixtureRequest('os', `/api/v1/clientes/documento/${clientCpf}`, adminTokens.accessToken);
      vehicle = await fixtureRequest('os', `/api/v1/veiculos/placa/${vehiclePlate}`, adminTokens.accessToken);
      await fixtureRequest('production', `/api/v1/production/stock/${pecaId}`, adminTokens.accessToken, { filialId: 'filial-sp', quantity: 3, description: 'Filtro do teste de navegador manual' }, 'PUT');
    });

    await test.step('Administrador abre a OS nas quatro etapas do wizard', async () => {
      await admin.goto(`${portalUrl}/#/ordens/nova`);
      await expect(admin.getByRole('heading', { name: 'Registrar entrada do veículo', exact: true })).toBeVisible();
      await admin.locator('select[name="filialId"]').selectOption('filial-sp');
      await admin.getByRole('combobox', { name: /^Cliente/ }).fill(clientCpf);
      await admin.getByRole('option').filter({ hasText: recordId(client) }).click();
      await expect(admin.locator('input[name="clienteId"]')).toHaveValue(recordId(client));
      await admin.getByRole('button', { name: 'Continuar', exact: true }).click();
      await admin.locator('select[name="veiculoId"]').selectOption(recordId(vehicle));
      await admin.getByRole('button', { name: 'Continuar', exact: true }).click();
      await admin.getByLabel('Problema relatado pelo cliente', { exact: true }).fill(`Revisão completa pelo fluxo manual ${pecaId}`);
      await admin.getByRole('button', { name: 'Continuar', exact: true }).click();
      await expect(admin.getByRole('heading', { name: 'Revise antes de criar', exact: true })).toBeVisible();
      const order = await submitAndCheck(admin, 'POST', (path) => path.endsWith('/ordens-servico'), () => admin.getByRole('button', { name: 'Criar ordem', exact: true }).click());
      orderId = recordId(order);
      evidence.orderId = orderId;
      evidence.orderTransitions.push('POST OS via wizard');
      await expect(admin).toHaveURL(new RegExp(`#\/ordens\/${orderId}$`));
      await refreshOrderUntil(admin, `/ordens-servico/${orderId}`, (snapshot) => snapshot.status === 'RECEBIDA' && Array.isArray(snapshot.sincronizacaoPendente) && snapshot.sincronizacaoPendente.length === 0, 'A OS deve existir nos três serviços sem inscrições pendentes');
      await capture(admin, '01-os-criada-pelo-wizard');
    });

    await test.step('Administrador seleciona o mecânico no combobox e atribui a OS', async () => {
      await admin.getByRole('button', { name: 'Informar mecânico', exact: true }).click();
      const dialog = admin.getByRole('dialog', { name: 'Atribuir mecânico', exact: true });
      await dialog.getByRole('combobox', { name: 'Mecânico responsável', exact: true }).fill(mechanicEmail);
      await dialog.getByRole('option').filter({ hasText: mechanicEmail }).click();
      await expect(dialog.getByRole('combobox')).toHaveValue(new RegExp(mechanicName));
      await submitAndCheck(admin, 'PATCH', (path) => path.includes(`/ordens-servico/${orderId}/atribuir/`), () => dialog.getByRole('button', { name: 'Atribuir', exact: true }).click());
      await refreshOrderUntil(admin, `/ordens-servico/${orderId}`, (snapshot) => snapshot.status === 'ATRIBUIDA', 'A atribuição deve chegar ao OS');
      evidence.orderTransitions.push('PATCH assignment via combobox');
    });

    const mechanic = await makeActor('mecanico');
    await test.step('Mecânico entra pelo formulário, registra diagnóstico e monta o orçamento', async () => {
      await loginOperator(mechanic, mechanicEmail, mechanicPassword);
      evidence.authentication.push('MECANICO: POST /api/v1/auth/login via form');
      await mechanic.goto(`${portalUrl}/#/ordens/${orderId}`);
      await refreshOrderUntil(mechanic, `/ordens-servico/mecanico/${orderId}`, (snapshot) => snapshot.status === 'ATRIBUIDA', 'O mecânico deve acessar somente sua OS');
      await mechanic.getByRole('button', { name: 'Registrar diagnóstico', exact: true }).click();
      let dialog = mechanic.getByRole('dialog', { name: 'Registrar diagnóstico', exact: true });
      await dialog.getByLabel('Descrição técnica', { exact: true }).fill('Filtro saturado; substituir e conferir funcionamento antes da entrega.');
      await submitAndCheck(mechanic, 'PATCH', (path) => path.endsWith(`/ordens-servico/${orderId}/diagnostico`), () => dialog.getByRole('button', { name: 'Salvar diagnóstico', exact: true }).click());
      await refreshOrderUntil(mechanic, `/ordens-servico/mecanico/${orderId}`, (snapshot) => snapshot.status === 'EM_DIAGNOSTICO' && Boolean(snapshot.diagnostico?.descricao), 'O diagnóstico deve ser persistido e refletido na OS');
      await mechanic.getByRole('button', { name: 'Gerar orçamento', exact: true }).click();
      dialog = mechanic.getByRole('dialog', { name: 'Gerar orçamento', exact: true });
      await dialog.getByLabel('Título do grupo', { exact: true }).fill('Revisão e troca do filtro');
      await dialog.locator('select[name^="type-"]').selectOption('MATERIAL');
      await dialog.getByLabel('Descrição', { exact: true }).fill('Filtro de óleo');
      await dialog.getByLabel('Quantidade', { exact: true }).fill('1');
      await dialog.getByLabel('Valor unitário', { exact: true }).fill('100');
      await dialog.getByLabel('ID da peça (para material)', { exact: true }).fill(pecaId);
      await submitAndCheck(mechanic, 'PATCH', (path) => path.endsWith(`/ordens-servico/${orderId}/orcamento`), () => dialog.getByRole('button', { name: 'Enviar ao cliente', exact: true }).click());
      await refreshOrderUntil(mechanic, `/ordens-servico/mecanico/${orderId}`, (snapshot) => snapshot.status === 'AGUARDANDO_APROVACAO' && snapshot.orcamento?.total === 100, 'Orçamento de R$100 deve aguardar o cliente');
      evidence.orderTransitions.push('PATCH diagnosis and budget via modals');
    });

    const clientPage = await makeActor('cliente');
    await test.step('Cliente faz login real por CPF e aprova o orçamento na própria OS', async () => {
      await clientPage.goto(`${portalUrl}/#/login`);
      await expect(clientPage.locator('[data-local-demo]')).toBeVisible();
      await clientPage.getByRole('tab', { name: 'Cliente', exact: true }).click();
      await clientPage.locator('#client-cpf').fill(clientCpf);
      const login = waitForMutation(clientPage, 'POST', (path) => path === '/auth/token');
      await clientPage.getByRole('button', { name: 'Acompanhar meu veículo', exact: true }).click();
      const authResponse = await login;
      expect(authResponse.ok()).toBeTruthy();
      expect(authResponse.request().postDataJSON().cpf.replace(/\D/g, '')).toBe(clientCpf);
      const access = decode(await authResponse.json());
      expect(access.access_token).toBeTruthy();
      expect(access.token_type).toBe('Bearer');
      await expect(clientPage).not.toHaveURL(/#\/login\/?$/);
      evidence.authentication.push('CLIENTE: POST /auth/token via CPF form, no session injection');
      await clientPage.goto(`${portalUrl}/#/ordens/${orderId}`);
      await refreshOrderUntil(clientPage, `/ordens-servico/minhas/${orderId}`, (snapshot) => snapshot.status === 'AGUARDANDO_APROVACAO', 'Cliente deve encontrar seu orçamento');
      await capture(clientPage, '02-cliente-cpf-orcamento-pendente');
      await confirmOrderAction(clientPage, orderId, 'Aprovar orçamento', 'Aprovar orçamento', 'aprovar');
      await refreshOrderUntil(clientPage, `/ordens-servico/minhas/${orderId}`, (snapshot) => snapshot.status === 'APROVADA' && snapshot.preparacao === 'COMPLETED', 'Saga deve confirmar reserva e liberar execução');
      evidence.orderTransitions.push('PATCH approval via client confirmation');
    });

    await test.step('Mecânico inicia, consome a peça reservada e finaliza pela interface', async () => {
      await refreshOrderUntil(mechanic, `/ordens-servico/mecanico/${orderId}`, (snapshot) => snapshot.preparacao === 'COMPLETED', 'A execução precisa ser liberada pela Saga');
      await confirmOrderAction(mechanic, orderId, 'Iniciar execução', 'Iniciar execução', 'iniciar-execucao');
      await refreshOrderUntil(mechanic, `/ordens-servico/mecanico/${orderId}`, (snapshot) => snapshot.status === 'EM_EXECUCAO', 'Início físico deve chegar ao OS');
      await mechanic.getByRole('button', { name: 'Consumir peça', exact: true }).click();
      const dialog = mechanic.getByRole('dialog', { name: 'Registrar consumo de peça', exact: true });
      await dialog.getByLabel('ID da peça', { exact: true }).fill(pecaId);
      await dialog.getByLabel('Quantidade', { exact: true }).fill('1');
      await submitAndCheck(mechanic, 'PATCH', (path) => path.endsWith(`/ordens-servico/${orderId}/consumo-peca`), () => dialog.getByRole('button', { name: 'Registrar consumo', exact: true }).click());
      await confirmOrderAction(mechanic, orderId, 'Finalizar serviço', 'Finalizar serviço', 'finalizar');
      await refreshOrderUntil(admin, `/ordens-servico/${orderId}`, (snapshot) => snapshot.status === 'AGUARDANDO_PAGAMENTO', 'Reparo completo ainda não permite entrega');
      await expect(admin.getByRole('button', { name: 'Registrar entrega', exact: true })).toHaveCount(0);
      evidence.orderTransitions.push('PATCH start, consumption and finish via UI');
    });

    await test.step('Cliente paga no checkout de demonstração e volta pelo redirecionamento real', async () => {
      await refreshOrderUntil(clientPage, `/ordens-servico/minhas/${orderId}`, (snapshot) => snapshot.status === 'AGUARDANDO_PAGAMENTO' && Boolean(snapshot.pagamento?.checkoutUrl), 'Cobrança deve ser criada somente após o reparo');
      await submitAndCheck(clientPage, 'POST', (route) => route.endsWith(`/billing/orders/${orderId}/checkout`), () => clientPage.getByRole('button', { name: 'Pagar OS', exact: true }).click(), false);
      await expect(clientPage).toHaveURL(/localhost:8088\/checkout\//);
      await expect(clientPage.getByText(/demonstração|simula/i).first()).toBeVisible();
      await capture(clientPage, '03-checkout-simulado-sem-cobranca-real');

      const rejected = waitForMutation(clientPage, 'POST', (route) => /^\/checkout\/[^/]+\/reject$/.test(route));
      await clientPage.getByRole('button', { name: 'Recusar pagamento de demonstração', exact: true }).click();
      expect((await rejected).status()).toBe(303);
      await expect(clientPage).toHaveURL(new RegExp(`#\/ordens\/${orderId}$`));
      const stillPending = await refreshOrderUntil(clientPage, `/ordens-servico/minhas/${orderId}`, (snapshot) => snapshot.status === 'AGUARDANDO_PAGAMENTO' && snapshot.pagamento?.status === 'REJECTED', 'Pagamento recusado não pode liberar o veículo');
      expect(stillPending.paymentConfirmed).toBe(false);
      await refreshOrderUntil(admin, `/ordens-servico/${orderId}`, (snapshot) => snapshot.status === 'AGUARDANDO_PAGAMENTO', 'Administrador continua bloqueado após recusa');
      await expect(admin.getByRole('button', { name: 'Registrar entrega', exact: true })).toHaveCount(0);
      evidence.paymentRejectedWithoutDelivery = true;
      await capture(clientPage, '04-pagamento-recusado-entrega-bloqueada');

      await submitAndCheck(clientPage, 'POST', (route) => route.endsWith(`/billing/orders/${orderId}/checkout`), () => clientPage.getByRole('button', { name: 'Pagar OS', exact: true }).click(), false);
      await expect(clientPage).toHaveURL(/localhost:8088\/checkout\//);
      const paid = waitForMutation(clientPage, 'POST', (path) => /^\/checkout\/[^/]+\/approve$/.test(path));
      await clientPage.getByRole('button', { name: 'Aprovar pagamento de demonstração', exact: true }).click();
      const checkoutResponse = await paid;
      expect(checkoutResponse.status()).toBe(303);
      await expect(clientPage).toHaveURL(new RegExp(`#\/ordens\/${orderId}$`));
      const returned = await refreshOrderUntil(clientPage, `/ordens-servico/minhas/${orderId}`, (snapshot) => snapshot.status === 'PRONTA_PARA_ENTREGA' && snapshot.paymentConfirmed === true, 'Webhook assinado deve liberar a retirada');
      expect(returned.pagamento?.status).toBe('APPROVED');
      evidence.payment = 'Browser POST checkout approve → signed webhook → Billing → SQS → OS';
      await capture(clientPage, '04-pagamento-confirmado-no-portal');
    });

    await test.step('Administrador entrega somente depois da confirmação de pagamento', async () => {
      await refreshOrderUntil(admin, `/ordens-servico/${orderId}`, (snapshot) => snapshot.status === 'PRONTA_PARA_ENTREGA', 'Entrega exige pagamento confirmado');
      await confirmOrderAction(admin, orderId, 'Registrar entrega', 'Confirmar entrega', 'entregar');
      await refreshOrderUntil(admin, `/ordens-servico/${orderId}`, (snapshot) => snapshot.status === 'ENTREGUE', 'OS deve terminar entregue');
      await admin.getByRole('tab', { name: 'Histórico', exact: true }).click();
      await expect(admin.locator('#panel-history')).toContainText('PAGAMENTO CONFIRMADO');
      await expect(admin.locator('#panel-history')).toContainText(/ENTREG/);
      await capture(admin, '05-os-entregue-historico-real');
      evidence.orderTransitions.push('PATCH delivery via admin confirmation');
    });
    completed = true;
  } finally {
    await testInfo.attach('manual-flow-evidence', { body: Buffer.from(JSON.stringify(evidence, null, 2)), contentType: 'application/json' });
    for (const actor of actors) {
      if (!completed) {
        await actor.page.screenshot({ path: testInfo.outputPath(`${actor.name}-failure.png`), fullPage: true }).catch(() => {});
        await actor.context.tracing.stop({ path: testInfo.outputPath(`${actor.name}-trace.zip`) });
      } else await actor.context.tracing.stop();
      await actor.context.close();
    }
  }
});
