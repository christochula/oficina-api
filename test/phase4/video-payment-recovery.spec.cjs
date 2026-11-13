const { test, expect } = require('@playwright/test');
const { randomInt, randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORTAL = 'http://localhost:5273', OS = 'http://localhost:3100';
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const idOf = record => typeof record.id === 'string' ? record.id : record.id.valor;

test('pagamento recusado e depois aprovado: mesma OS, retorno e entrega bloqueada até confirmação', async ({ browser }, testInfo) => {
  const directory = process.env.VIDEO_REHEARSAL_RUN_DIR || testInfo.outputDir;
  fs.mkdirSync(directory, { recursive: true });
  const prefix = `VIDEO-PAY-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const events = [], contexts = [], errors = [], uiMutations = [], observations = [];
  let setupDone = false, order, finished = false, imageNumber = 0;
  const log = (kind, detail) => { const event = { at: new Date().toISOString(), kind, ...detail }; events.push(event); fs.appendFileSync(path.join(directory, 'payment-recovery-events.jsonl'), JSON.stringify(event) + '\n'); };
  async function request(route, token, method = 'GET', body, base = OS) {
    if (setupDone && method !== 'GET') throw new Error('Only read-only verification is allowed after this payment fixture is ready.');
    if (![OS, PORTAL, 'http://localhost:3101', 'http://localhost:8188'].includes(base)) throw new Error('Only isolated local endpoints are allowed.');
    const start = performance.now();
    const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const raw = await response.json(); log(setupDone ? 'verification-api' : 'fixture-api', { route: route.split('?')[0], method, status: response.status, serviceMs: Math.round(performance.now() - start) });
    if (!response.ok) throw new Error(`${method} ${route.split('?')[0]} returned HTTP ${response.status}`);
    return raw.data ?? raw;
  }
  async function eventually(label, work, predicate) {
    const start = performance.now(); let last;
    while (performance.now() - start < 60_000) { try { last = await work(); if (predicate(last)) { log('verification-wait', { label, serviceMs: Math.round(performance.now() - start) }); return last; } } catch (error) { last = error.message; } await delay(350); }
    throw new Error(`${label} did not converge: ${JSON.stringify(last)}`);
  }
  async function click(page, locator, label) { const start = performance.now(); await locator.click(); log('click', { role: page.role, label, automationMs: Math.round(performance.now() - start) }); }
  async function capture(page, label) {
    const name = `payment-${String(++imageNumber).padStart(2, '0')}-${label}`;
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(directory, name + '-viewport.png'), fullPage: false, animations: 'disabled' }); await page.screenshot({ path: path.join(directory, name + '-full.png'), fullPage: true, animations: 'disabled' });
    fs.writeFileSync(path.join(directory, name + '.txt'), await page.locator('body').innerText()); log('evidence', { role: page.role, viewport: name + '-viewport.png', full: name + '-full.png', text: name + '.txt' });
    await testInfo.attach(name, { path: path.join(directory, name + '-viewport.png'), contentType: 'image/png' });
  }
  async function actor(role, credentials) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }); contexts.push(context);
    await context.route('**/*', route => { const url = new URL(route.request().url()); return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && ['5273', '3100', '3101', '3102', '8188'].includes(url.port) ? route.continue() : route.abort(); });
    const page = await context.newPage(); page.role = role; page.on('pageerror', error => errors.push({ role, message: error.message }));
    page.on('response', response => { const req = response.request(), url = new URL(response.url()); if (req.method() !== 'GET' && !url.pathname.includes('/auth/') && url.pathname !== '/auth/token') { const item = { role, method: req.method(), route: url.pathname, status: response.status() }; uiMutations.push(item); log('ui-mutation', item); } });
    await page.goto(PORTAL + '/#/login');
    if (role === 'CLIENTE') { await page.getByRole('tab', { name: 'Cliente', exact: true }).click(); await page.locator('#client-cpf').fill(credentials.cpf); await page.getByRole('button', { name: 'Acompanhar meu veículo', exact: true }).click(); }
    else { await page.getByRole('tab', { name: 'Equipe', exact: true }).click(); await page.locator('#operator-email').fill(credentials.email); await page.locator('#operator-password').fill(credentials.password); await page.getByRole('button', { name: 'Entrar como equipe', exact: true }).click(); }
    await expect(page).not.toHaveURL(/#\/login\/?$/); log('login-form', { role, credentialValuesRecorded: false }); return page;
  }
  async function open(page) {
    await click(page, page.locator('.sidebar-nav').getByRole('link', { name: page.role === 'CLIENTE' ? 'Minhas ordens' : 'Ordens de serviço', exact: true }), 'Abrir lista');
    await page.locator('#order-search').fill('#' + order.numero); log('search', { role: page.role, query: '#' + order.numero });
    const row = page.locator('tbody tr').filter({ has: page.locator('.table-primary-link strong', { hasText: new RegExp(`^#${order.numero}$`) }) }); await expect(row).toHaveCount(1);
    await click(page, row.getByRole('link', { name: 'Abrir', exact: true }), 'Abrir mesma OS por número'); await expect(page.locator('#next-action-title')).toBeVisible();
  }

  let admin, client, adminToken;
  try {
    expect(execFileSync('docker', ['inspect', '--format', '{{ index .Config.Labels "com.docker.compose.project" }}', 'oficina-phase4-test-ux-os-1'], { encoding: 'utf8' }).trim()).toBe('oficina-phase4-test-ux');
    const adminCredentials = { email: process.env.DEMO_ADMIN_EMAIL || 'admin@oficina.com', password: process.env.DEMO_ADMIN_PASSWORD || 'Local-only-admin-password-2026' };
    let cpf = String(randomInt(100000000, 999999999)); for (const weight of [10, 11]) { const digit = 10 * [...cpf].reduce((sum, number, index) => sum + Number(number) * (weight - index), 0) % 11; cpf += digit === 10 ? 0 : digit; }
    adminToken = (await request('/api/v1/auth/login', null, 'POST', { email: adminCredentials.email, senha: adminCredentials.password })).accessToken;
    const mechanicCredentials = { email: `${prefix.toLowerCase()}@example.com`, password: `Local-${randomUUID()}` };
    const mechanic = await request('/api/v1/usuarios', adminToken, 'POST', { nome: `Mecânico ${prefix}`, email: mechanicCredentials.email, senha: mechanicCredentials.password, papel: 'MECANICO' });
    const mechanicToken = (await request('/api/v1/auth/login', null, 'POST', { email: mechanicCredentials.email, senha: mechanicCredentials.password })).accessToken;
    const customer = await request('/api/v1/clientes', adminToken, 'POST', { tipoDoc: 'CPF', numeroDoc: cpf, nome: `Cliente ${prefix}`, email: `${prefix.toLowerCase()}-client@example.com`, telefone: '11999990000' });
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', plate = `P${alphabet[randomInt(26)]}${alphabet[randomInt(26)]}${randomInt(10)}${alphabet[randomInt(26)]}${randomInt(10)}${randomInt(10)}`;
    const vehicle = await request('/api/v1/veiculos', adminToken, 'POST', { placa: plate, renavam: String(Date.now()).slice(-11), chassi: `9PY${String(Date.now()).padStart(14, '0')}`, marca: 'Fictícia', modelo: prefix, ano: 2022, cor: 'Prata' });
    const clientToken = (await request('/auth/token', null, 'POST', { cpf }, PORTAL)).access_token;
    order = await request('/api/v1/ordens-servico', adminToken, 'POST', { filialId: 'filial-sp', clienteId: idOf(customer), veiculoId: idOf(vehicle), problemasRelatados: [{ descricao: `${prefix}: fixture independente de recuperação de pagamento` }] });
    const read = () => request(`/api/v1/ordens-servico/${order.id}`, adminToken);
    await eventually('Participantes criados', read, value => value.sincronizacaoPendente?.length === 0);
    await request(`/api/v1/ordens-servico/${order.id}/atribuir/${idOf(mechanic)}`, adminToken, 'PATCH');
    await eventually('Atribuição efetiva', () => request(`/api/v1/ordens-servico/mecanico/${order.id}`, mechanicToken), value => value.mecanicoResponsavelId === idOf(mechanic));
    await eventually('Atribuição propagada ao Billing', () => request(`/api/v1/billing/orders/${order.id}`, adminToken, 'GET', undefined, 'http://localhost:3101'), value => value.mecanicoId === idOf(mechanic));
    await request(`/api/v1/ordens-servico/${order.id}/diagnostico`, mechanicToken, 'PATCH', { descricao: 'Serviço sem materiais para fixture de recuperação de pagamento' });
    await request(`/api/v1/ordens-servico/${order.id}/orcamento`, mechanicToken, 'PATCH', { grupos: [{ titulo: 'Fixture de pagamento', linhas: [{ tipo: 'SERVICO', descricao: 'Serviço de demonstração', quantidade: 1, valorUnitario: 175 }] }] });
    await eventually('Orçamento pronto', read, value => value.status === 'AGUARDANDO_APROVACAO');
    await request(`/api/v1/ordens-servico/${order.id}/aprovar`, clientToken, 'PATCH'); await eventually('Preparação pronta', read, value => value.preparacao === 'COMPLETED');
    await request(`/api/v1/ordens-servico/${order.id}/iniciar-execucao`, mechanicToken, 'PATCH'); await eventually('Execução iniciada', read, value => value.status === 'EM_EXECUCAO');
    await request(`/api/v1/ordens-servico/${order.id}/finalizar`, mechanicToken, 'PATCH');
    await eventually('Fixture aguardando pagamento com checkout', read, value => value.status === 'AGUARDANDO_PAGAMENTO' && Boolean(value.pagamento?.checkoutUrl));
    setupDone = true; log('fixture-ready', { orderId: order.id, number: order.numero, setupViaApiUntil: 'AGUARDANDO_PAGAMENTO', total: 175, noMaterials: true });
    admin = await actor('ADMINISTRADOR', adminCredentials); client = await actor('CLIENTE', { cpf });
    await open(admin); await expect(admin.getByRole('button', { name: 'Registrar entrega', exact: true })).toHaveCount(0);
    await open(client); await expect(client.getByRole('button', { name: 'Pagar OS', exact: true })).toBeVisible();

    await test.step('Recusa pelo simulador mantém a mesma OS e bloqueia entrega', async () => {
      await click(client, client.getByRole('button', { name: 'Pagar OS', exact: true }), 'Abrir checkout'); await expect(client).toHaveURL(/http:\/\/localhost:8188\/checkout\//); await expect(client.locator('body')).toContainText('175,00');
      await capture(client, 'before-rejection'); const rejection = client.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/reject'));
      await click(client, client.getByRole('button', { name: 'Recusar pagamento de demonstração', exact: true }), 'Recusar pagamento simulado'); expect((await rejection).status()).toBe(303); await expect(client).toHaveURL(PORTAL + '/#/ordens/' + order.id);
      const rejected = await eventually('Pagamento recusado preserva bloqueio', read, value => value.pagamento?.status === 'REJECTED'); expect(rejected.status).toBe('AGUARDANDO_PAGAMENTO'); expect(rejected.paymentConfirmed).toBe(false); expect(rejected.orcamento.total).toBe(175);
      await client.reload(); await expect(client.getByRole('button', { name: 'Pagar OS', exact: true })).toBeVisible(); await expect(admin.getByRole('button', { name: 'Registrar entrega', exact: true })).toHaveCount(0); await capture(client, 'rejected-same-order'); await capture(admin, 'delivery-blocked-after-rejection');
      observations.push({ phase: 'REJECTED', orderNumber: order.numero, status: rejected.status, paymentConfirmed: false, deliveryAvailable: false, sameOrderReturn: true });
    });

    await test.step('Nova aprovação pela UI libera entrega somente após confirmação', async () => {
      await click(client, client.getByRole('button', { name: 'Pagar OS', exact: true }), 'Reabrir cobrança da mesma OS'); await expect(client).toHaveURL(/http:\/\/localhost:8188\/checkout\//);
      const approval = client.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/approve'));
      await click(client, client.getByRole('button', { name: 'Aprovar pagamento de demonstração', exact: true }), 'Aprovar pagamento simulado'); expect((await approval).status()).toBe(303); await expect(client).toHaveURL(PORTAL + '/#/ordens/' + order.id);
      const paid = await eventually('Confirmação libera retirada', read, value => value.status === 'PRONTA_PARA_ENTREGA' && value.paymentConfirmed === true); expect(paid.pagamento.status).toBe('APPROVED'); expect(paid.orcamento.total).toBe(175);
      await expect(admin.getByRole('button', { name: 'Registrar entrega', exact: true })).toBeVisible({ timeout: 60_000 }); await capture(client, 'approved-return'); await capture(admin, 'delivery-now-enabled');
      const payments = await request(`/v1/payments/search?external_reference=${encodeURIComponent(paid.pagamento.externalReference)}`, null, 'GET', undefined, 'http://localhost:8188'); expect(payments.results.filter(payment => payment.status === 'approved')).toHaveLength(1); expect(payments.results.filter(payment => payment.status === 'rejected')).toHaveLength(1);
      await click(admin, admin.getByRole('button', { name: 'Registrar entrega', exact: true }), 'Registrar entrega'); await click(admin, admin.getByRole('dialog').getByRole('button', { name: 'Confirmar entrega', exact: true }), 'Confirmar entrega'); await expect(admin.locator('.page-header .status-badge')).toContainText('Entregue', { timeout: 60_000 });
      const delivered = await eventually('Entrega persistida', read, value => value.status === 'ENTREGUE'); expect(delivered.historico.filter(item => item.evento === 'PAGAMENTO_CONFIRMADO')).toHaveLength(1); expect(delivered.historico.filter(item => item.evento === 'VEICULO_ENTREGUE')).toHaveLength(1);
      await capture(admin, 'delivered-once'); observations.push({ phase: 'APPROVED', orderNumber: order.numero, status: delivered.status, paymentConfirmed: true, approvedPayments: 1, rejectedPayments: 1, deliveryEvents: 1, sameOrderReturn: true });
    });
    expect(errors).toEqual([]); finished = true;
  } catch (error) {
    log('failure', { message: error.message }); for (const page of [admin, client].filter(Boolean)) if (!page.url().includes('/login')) await capture(page, 'failure-' + page.role).catch(() => {}); throw error;
  } finally {
    const result = { run: process.env.VIDEO_REHEARSAL_RUN_ID, prefix, status: finished ? 'LOCAL_PASS' : 'LOCAL_FAILED', awsStatus: 'AWS_PENDING', order: order ? { id: order.id, number: order.numero } : null, total: 175, setup: 'API até AGUARDANDO_PAGAMENTO; fixture independente, sem materiais', actionsUnderTest: 'Login real; checkout/recusa/nova aprovação/retorno/entrega somente pela UI', observations, uiMutations, browserErrors: errors, videoRecorded: false, credentialsPersisted: false, directApisAfterSetup: 'GET_ONLY', externalAccess: false, metrics: { clicks: events.filter(event => event.kind === 'click').length, searches: events.filter(event => event.kind === 'search').length, uuidTranscriptions: 0, automationActionMs: events.reduce((sum, event) => sum + (event.automationMs || 0), 0), explicitVerificationWaitMs: events.filter(event => event.kind === 'verification-wait').reduce((sum, event) => sum + event.serviceMs, 0), note: 'Automação, não tempo de compreensão humana; latências de API separadas nos eventos.' } };
    fs.writeFileSync(path.join(directory, 'payment-recovery-results.json'), JSON.stringify(result, null, 2)); await testInfo.attach('payment-recovery-results', { path: path.join(directory, 'payment-recovery-results.json'), contentType: 'application/json' }); for (const context of contexts) await context.close();
  }
});
