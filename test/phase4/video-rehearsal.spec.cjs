const { test, expect } = require('@playwright/test');
const { createHash, randomInt, randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORTAL = 'http://localhost:5273';
const OS = 'http://localhost:3100';
const PRODUCTION = 'http://localhost:3102';
const PROJECT = 'oficina-phase4-test-ux';
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const idOf = value => typeof value.id === 'string' ? value.id : value.id.valor;

function fictionalCpf() {
  let value = String(randomInt(100000000, 999999999));
  for (const weight of [10, 11]) {
    const digit = 10 * [...value].reduce((sum, number, index) => sum + Number(number) * (weight - index), 0) % 11;
    value += digit === 10 ? 0 : digit;
  }
  return value;
}

test('roteiro exato: quatro perfis, R$175, compensação, reposição, consumo, pagamento e entrega na mesma OS', async ({ browser }, testInfo) => {
  const directory = process.env.VIDEO_REHEARSAL_RUN_DIR || testInfo.outputDir;
  fs.mkdirSync(directory, { recursive: true });
  const prefix = `VIDEO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const actors = [], events = [], browserErrors = [], requests = [];
  let currentBlock = 0, order, firstSaga, recoveredSaga, fixtureClosed = false, finished = false, captureNumber = 0;
  const blocks = [
    { block: 1, title: 'Apresentação', status: 'AWS_PENDING', localScope: 'Portal e perfis locais podem ser enquadrados; repositórios/participantes não são comprovados por este teste.', awsCriteria: 'Portal cloud e apresentação dos participantes/repositórios conferidos.' },
    { block: 2, title: 'Arquitetura e Saga', status: 'AWS_PENDING', localScope: 'Não executado: diagrama e arquitetura não são uma ação de negócio do portal.', awsCriteria: 'Diagrama renderizado, três donos de dados, SQS/DLQ e EKS legíveis e correspondentes à release.' },
    { block: 3, title: 'Conferência das quatro sessões e peças', status: 'LOCAL_NOT_RUN', awsCriteria: 'Quatro sessões e peças exclusivas conferidas na conta cloud de destino; dados históricos preservados.' },
    ...['Abertura e atribuição', 'Diagnóstico e orçamento', 'Aprovação, compensação e handoff', 'Reposição e nova Saga', 'Execução, consumo e entrega bloqueada', 'Pagamento e entrega'].map((title, index) => ({ block: index + 4, title, status: 'LOCAL_NOT_RUN', awsCriteria: 'Repetir na release AWS com a mesma OS cloud, sessões isoladas e evidências da execução.' })),
    { block: 10, title: 'CI, qualidade e deploy', status: 'AWS_PENDING', localScope: 'Este teste não verifica ou dispara pipelines/deploys.', awsCriteria: 'CI/Sonar, imagem e rollout dos três serviços correspondem ao SHA mostrado; healths via Gateway atualizados.' },
    { block: 11, title: 'Observabilidade Datadog', status: 'AWS_PENDING', localScope: 'Logs locais de automação não comprovam ingestão no Datadog.', awsCriteria: 'Logs, traces correlacionados e métricas dos três serviços na janela da OS cloud; duas Sagas e confirmação do provedor identificadas.' },
    { block: 12, title: 'Encerramento', status: 'LOCAL_NOT_RUN', awsCriteria: 'Nova OS cloud entregue; referências, participantes, RMs e URL do vídeo conferidos na entrega.' },
  ];
  const log = (kind, data = {}) => {
    const event = { at: new Date().toISOString(), block: currentBlock, kind, ...data };
    events.push(event); fs.appendFileSync(path.join(directory, 'events.jsonl'), JSON.stringify(event) + '\n');
  };
  const step = async (page, kind, label, work) => {
    const start = performance.now();
    try { const result = await work(); log(kind, { role: page?.role, label, automationMs: Math.round(performance.now() - start) }); return result; }
    catch (error) { log('action-failed', { role: page?.role, actionKind: kind, label, automationMs: Math.round(performance.now() - start), message: error.message }); throw error; }
  };
  const click = (page, locator, label) => step(page, 'click', label, () => locator.click());
  const fill = (page, locator, value, label) => step(page, 'fill', label, () => locator.fill(String(value)));
  const wait = (page, label, work) => step(page, 'service-wait', label, work);
  const select = (page, locator, value, label) => step(page, 'select', label, () => locator.selectOption(value));
  async function api(base, route, token, method = 'GET', body) {
    if (fixtureClosed && method !== 'GET') throw new Error('After setup, direct APIs are read-only. Business transitions must use the UI.');
    if (!['http://localhost:3100', 'http://localhost:3101', 'http://localhost:3102'].includes(base)) throw new Error('Only the isolated local stack is allowed.');
    const started = performance.now();
    const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const raw = await response.json(); log(fixtureClosed ? 'verification-api' : 'fixture-api', { method, route: route.split('?')[0], status: response.status, serviceMs: Math.round(performance.now() - started) });
    if (!response.ok) throw new Error(`Local ${method} ${route.split('?')[0]} returned HTTP ${response.status}.`);
    return raw.data ?? raw;
  }
  async function eventually(label, read, predicate, timeout = 60_000) {
    const start = performance.now(); let last;
    for (;;) {
      try { last = await read(); if (predicate(last)) { log('verification-wait', { label, serviceMs: Math.round(performance.now() - start) }); return last; } } catch (error) { last = { error: error.message }; }
      if (performance.now() - start > timeout) throw new Error(`${label} did not converge: ${JSON.stringify(last)}`);
      await sleep(350);
    }
  }
  async function shot(page, label) {
    await page.evaluate(() => document.fonts.ready);
    const basename = `${String(++captureNumber).padStart(2, '0')}-${label}`;
    const viewport = path.join(directory, `${basename}-viewport.png`), full = path.join(directory, `${basename}-full.png`);
    await page.screenshot({ path: viewport, fullPage: false, animations: 'disabled' }); await page.screenshot({ path: full, fullPage: true, animations: 'disabled' });
    fs.writeFileSync(path.join(directory, `${basename}.txt`), await page.locator('body').innerText());
    const layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, contentWidth: document.documentElement.scrollWidth }));
    expect(layout.contentWidth).toBeLessThanOrEqual(layout.width + 1);
    log('evidence', { role: page.role, viewport: path.basename(viewport), full: path.basename(full), text: `${basename}.txt`, layout });
    await testInfo.attach(basename, { path: viewport, contentType: 'image/png' });
  }
  async function actor(role, credentials) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (!['http:', 'ws:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || !['5273', '3100', '3101', '3102', '8188'].includes(url.port)) return route.abort();
      return route.continue();
    });
    const page = await context.newPage(); page.role = role; actors.push({ role, context, page });
    page.on('pageerror', error => browserErrors.push({ role, message: error.message }));
    page.on('response', response => {
      const request = response.request(), url = new URL(response.url());
      if (url.pathname.startsWith('/api/') && !url.pathname.includes('/auth/')) {
        const item = { role, method: request.method(), path: url.pathname, status: response.status() };
        requests.push(item); log('ui-response', item);
      }
    });
    await step(page, 'navigation', 'Abrir login', () => page.goto(PORTAL + '/#/login'));
    if (role === 'CLIENTE') {
      await click(page, page.getByRole('tab', { name: 'Cliente', exact: true }), 'Perfil cliente');
      await fill(page, page.locator('#client-cpf'), credentials.cpf, 'Documento fictício de autenticação (valor não registrado)');
      await click(page, page.getByRole('button', { name: 'Acompanhar meu veículo', exact: true }), 'Entrar cliente');
    } else {
      await click(page, page.getByRole('tab', { name: 'Equipe', exact: true }), 'Perfil equipe');
      await fill(page, page.locator('#operator-email'), credentials.email, 'Identificação de autenticação (valor não registrado)');
      await fill(page, page.locator('#operator-password'), credentials.password, 'Senha (valor não registrado)');
      await click(page, page.getByRole('button', { name: 'Entrar como equipe', exact: true }), 'Entrar equipe');
    }
    await wait(page, 'Autenticação por formulário', () => expect(page).not.toHaveURL(/#\/login\/?$/));
    return page;
  }
  async function menu(page, label) { await click(page, page.locator('.sidebar-nav').getByRole('link', { name: label, exact: true }), `Navegar: ${label}`); }
  async function choose(page, selector, query) {
    const input = page.locator(selector); await fill(page, input, query, `Buscar ${query}`); log('search', { role: page.role, query });
    const option = input.locator('xpath=../..').getByRole('option').filter({ hasText: query }).first();
    await wait(page, 'Resultado remoto por identificação humana', () => expect(option).toBeVisible()); await click(page, option, `Selecionar ${query}`);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
  }
  async function openOrder(page) {
    await menu(page, ['CLIENTE', 'MECANICO'].includes(page.role) ? 'Minhas ordens' : 'Ordens de serviço');
    await fill(page, page.locator('#order-search'), '#' + order.numero, 'Buscar número visível da OS'); log('search', { role: page.role, query: '#' + order.numero });
    const row = page.locator('tbody tr').filter({ has: page.locator('.table-primary-link strong', { hasText: new RegExp(`^#${order.numero}$`) }) });
    await wait(page, 'Localizar a mesma OS', () => expect(row).toHaveCount(1)); await click(page, row.getByRole('link', { name: /Abrir|Analisar/ }), 'Abrir OS pelo número');
    await expect(page.locator('#next-action-title')).toBeVisible(); await expect(page.locator('.page-header h1')).toHaveText('#' + order.numero);
  }
  async function mutation(page, method, suffix, work) {
    const pending = page.waitForResponse(response => response.request().method() === method && new URL(response.url()).pathname.endsWith(suffix), { timeout: 60_000 });
    pending.catch(() => {}); await work(); const response = await wait(page, method + ' ' + suffix.split('/').at(-1), () => pending);
    expect(response.ok(), `UI mutation ${method} ${suffix} HTTP ${response.status()}`).toBe(true);
    const raw = await response.json(); return raw.data ?? raw;
  }
  async function confirm(page, trigger, confirmation = trigger) {
    await click(page, page.getByRole('button', { name: trigger, exact: true }), trigger);
    await click(page, page.getByRole('dialog').getByRole('button', { name: confirmation, exact: true }), confirmation);
  }
  function passed(block, detail) { Object.assign(blocks.find(item => item.block === block), { status: 'LOCAL_PASS', detail }); log('block-result', { block, status: 'LOCAL_PASS', detail }); }

  let credentials, fixture, adminToken, mechanicToken;
  try {
    await test.step('Pré-condições locais e massa exclusiva', async () => {
      const images = [];
      for (const service of ['os', 'billing', 'production', 'mercadopago']) {
        const raw = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .}}', `${PROJECT}-${service}-1`], { encoding: 'utf8' }));
        expect(raw.Config.Labels['com.docker.compose.project']).toBe(PROJECT);
        images.push({ service, name: raw.Name, image: raw.Image, created: raw.Created });
      }
      const sourceFiles = ['frontend/src/views/orders.js', 'frontend/src/views/order-wizard.js', 'frontend/src/views/order-budget.js', 'frontend/src/views/resources.js', 'frontend/src/components/catalog-combobox.js', 'src/phase4/service.ts', 'test/phase4/video-rehearsal.spec.cjs'];
      const hashes = Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', file))).digest('hex')]));
      fs.writeFileSync(path.join(directory, 'release-manifest.json'), JSON.stringify({ observedAt: new Date().toISOString(), images, hashes, note: 'Hashes dos arquivos executados; não atribuídos a um SHA de commit enquanto existirem mudanças locais.' }, null, 2));
      for (const endpoint of [OS + '/api/health/ready', 'http://localhost:3101/api/v1/billing/health', PRODUCTION + '/api/v1/production/health', 'http://localhost:8188/health']) expect((await fetch(endpoint)).ok).toBe(true);
      credentials = {
        admin: { email: process.env.DEMO_ADMIN_EMAIL || 'admin@oficina.com', password: process.env.DEMO_ADMIN_PASSWORD || 'Local-only-admin-password-2026' },
        mechanic: { email: `${prefix.toLowerCase()}-mechanic@example.com`, password: `Local-${randomUUID()}` },
        consultant: { email: `${prefix.toLowerCase()}-consultant@example.com`, password: `Local-${randomUUID()}` },
        client: { cpf: fictionalCpf() },
      };
      adminToken = (await api(OS, '/api/v1/auth/login', null, 'POST', { email: credentials.admin.email, senha: credentials.admin.password })).accessToken;
      const mechanic = await api(OS, '/api/v1/usuarios', adminToken, 'POST', { nome: `Mecânico ${prefix}`, email: credentials.mechanic.email, senha: credentials.mechanic.password, papel: 'MECANICO' });
      await api(OS, '/api/v1/usuarios', adminToken, 'POST', { nome: `Consultor ${prefix}`, email: credentials.consultant.email, senha: credentials.consultant.password, papel: 'CONSULTOR_TECNICO' });
      mechanicToken = (await api(OS, '/api/v1/auth/login', null, 'POST', { email: credentials.mechanic.email, senha: credentials.mechanic.password })).accessToken;
      const client = await api(OS, '/api/v1/clientes', adminToken, 'POST', { tipoDoc: 'CPF', numeroDoc: credentials.client.cpf, nome: `Cliente ${prefix}`, email: `${prefix.toLowerCase()}-client@example.com`, telefone: '11999990000' });
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', plate = `V${letters[randomInt(26)]}${letters[randomInt(26)]}${randomInt(10)}${letters[randomInt(26)]}${randomInt(10)}${randomInt(10)}`;
      const vehicle = await api(OS, '/api/v1/veiculos', adminToken, 'POST', { placa: plate, renavam: String(Date.now()).slice(-11), chassi: `9VD${String(Date.now()).padStart(14, '0')}`, marca: 'Fictícia', modelo: `Vídeo ${prefix}`, ano: 2022, cor: 'Azul' });
      const service = await api(OS, '/api/v1/servicos-oficina', adminToken, 'POST', { nome: `Revisão ${prefix}`, descricao: 'Revisão preventiva do ensaio local de vídeo', categoria: 'Demonstração' });
      const parts = [];
      for (const [suffix, name, price, stock] of [['A', 'Filtro', 50, 1], ['B', 'Junta', 25, 0]]) {
        const part = await api(OS, '/api/v1/estoque/pecas', adminToken, 'POST', { codigo: `${prefix}-${suffix}`, nome: `${name} ${prefix}`, descricao: `${suffix === 'A' ? 'Material disponível' : 'Material sem saldo'} — ensaio exato de R$175`, precoVenda: price, filialId: 'filial-sp', quantidadeInicial: stock, quantidadeMinima: 1 });
        parts.push({ id: idOf(part.peca), code: part.peca.codigo, name: part.peca.nome, price, initial: stock });
      }
      fixture = { prefix, fictional: true, branch: 'filial-sp', client: { id: idOf(client), name: client.nome }, vehicle: { id: idOf(vehicle), plate }, service: { id: idOf(service), name: service.nome }, mechanic: { id: idOf(mechanic), name: mechanic.nome }, parts };
      fs.writeFileSync(path.join(directory, 'fixture-public.json'), JSON.stringify(fixture, null, 2));
      fixtureClosed = true;
    });
    const read = () => api(OS, `/api/v1/ordens-servico/${order.id}`, adminToken);
    const stock = part => api(OS, `/api/v1/estoque/pecas/${part.id}?filialId=filial-sp`, adminToken);
    const admin = await actor('ADMINISTRADOR', credentials.admin), mechanic = await actor('MECANICO', credentials.mechanic), client = await actor('CLIENTE', credentials.client), consultant = await actor('CONSULTOR_TECNICO', credentials.consultant);
    currentBlock = 1; await shot(admin, '01-portal-local');

    currentBlock = 3;
    await test.step('3 — Quatro sessões isoladas e peças da tomada', async () => {
      await menu(admin, 'Estoque'); await wait(admin, 'Carregamento inicial do estoque', () => expect(admin.locator('tbody tr').first()).toBeVisible());
      await fill(admin, admin.locator('#resource-branch'), 'filial-sp', 'Filtrar São Paulo'); await fill(admin, admin.locator('#resource-search-input'), prefix, 'Buscar somente as peças desta tomada'); log('search', { role: admin.role, query: prefix });
      await expect(admin.locator('tbody tr')).toHaveCount(2);
      for (const part of fixture.parts) { const row = admin.locator('tbody tr').filter({ hasText: part.code }); await expect(row).toContainText(`${part.initial} disponíveis`); await expect(row).toContainText('Reservadas: 0'); await expect(row).toContainText('Filial: filial-sp'); }
      await shot(admin, '03-isolated-fixture-stock');
      passed(3, { independentContexts: 4, authentication: 'REAL_FORMS', branch: 'filial-sp', initialAvailable: [1, 0], initialReserved: [0, 0] });
    });

    currentBlock = 4;
    await test.step('4 — Admin abre a OS com duas peças de uma unidade e atribui', async () => {
      for (const part of fixture.parts) { const balance = await stock(part); expect(balance.quantidadeDisponivel).toBe(part.initial); expect(balance.quantidadeReservada).toBe(0); expect(balance.quantidadeConsumida).toBe(0); }
      await menu(admin, 'Ordens de serviço'); await click(admin, admin.getByRole('link', { name: 'Nova ordem', exact: true }), 'Nova ordem');
      await choose(admin, '#order-client-input', fixture.client.name); await select(admin, admin.locator('[name="filialId"]'), 'filial-sp', 'Filial São Paulo'); await click(admin, admin.locator('[data-action="wizard:next"]'), 'Continuar cliente');
      await choose(admin, '#order-vehicle-input', fixture.vehicle.plate); await click(admin, admin.locator('[data-action="wizard:next"]'), 'Continuar veículo');
      await fill(admin, admin.locator('#problemaDescricao'), `${prefix} — revisão e troca de filtro/junta`, 'Problema relatado'); await choose(admin, '#order-service-input', fixture.service.name);
      await fill(admin, admin.locator('[name="notasCliente"]'), `PÚBLICA ${prefix}: aguarde a aprovação do orçamento.`, 'Nota visível ao cliente'); await fill(admin, admin.locator('[name="notasInternas"]'), `PRIVADA ${prefix}: conferir encaixe da junta.`, 'Nota interna');
      for (const [index, part] of fixture.parts.entries()) {
        if (index) await click(admin, admin.getByRole('button', { name: 'Adicionar peça', exact: true }), 'Adicionar segunda peça');
        await choose(admin, `#order-piece-${index + 1}-input`, part.code); await fill(admin, admin.locator(`[name="pecaQuantidade-${index + 1}"]`), '1', 'Solicitar uma unidade');
      }
      await click(admin, admin.locator('[data-action="wizard:next"]'), 'Revisar ordem'); await expect(admin.locator('#order-review')).toContainText(fixture.vehicle.plate); await expect(admin.locator('#order-review')).toContainText(fixture.parts[1].code); await shot(admin, '04-review');
      order = await mutation(admin, 'POST', '/ordens-servico', () => click(admin, admin.getByRole('button', { name: 'Criar ordem', exact: true }), 'Criar uma única OS'));
      await wait(admin, 'Participantes confirmam abertura', () => expect(admin.getByRole('button', { name: 'Informar mecânico', exact: true })).toBeVisible({ timeout: 60_000 }));
      await click(admin, admin.getByRole('button', { name: 'Informar mecânico', exact: true }), 'Informar mecânico'); const dialog = admin.getByRole('dialog');
      await fill(admin, dialog.getByRole('combobox', { name: 'Mecânico responsável', exact: true }), fixture.mechanic.name, 'Buscar mecânico pelo nome');
      await click(admin, dialog.getByRole('option').filter({ hasText: fixture.mechanic.name }), 'Selecionar mecânico');
      await mutation(admin, 'PATCH', '/atribuir/' + fixture.mechanic.id, () => click(admin, dialog.getByRole('button', { name: 'Atribuir', exact: true }), 'Atribuir')); await expect(dialog).toHaveCount(0);
      await eventually('Acesso real do mecânico após projeção da atribuição', () => api(OS, `/api/v1/ordens-servico/mecanico/${order.id}`, mechanicToken), value => value.mecanicoResponsavelId === fixture.mechanic.id);
      const value = await read(); expect(value.pecasSolicitadas).toHaveLength(2); expect(value.pecasSolicitadas.map(part => part.quantidade)).toEqual([1, 1]);
      await step(admin, 'navigation', 'Recarregar e conferir solicitações persistidas', () => admin.reload());
      await expect(admin.locator('.context-card').filter({ has: admin.getByRole('heading', { name: 'Peças solicitadas na abertura', exact: true }) })).toContainText(fixture.parts[0].code);
      await shot(admin, '04-assigned'); passed(4, { number: order.numero, requestedPieces: 2, quantityEach: 1, mechanic: fixture.mechanic.name, uuidTranscriptions: 0 });
    });

    currentBlock = 5;
    await test.step('5 — Mecânico registra diagnóstico e orçamento 100+50+25', async () => {
      await openOrder(mechanic); await click(mechanic, mechanic.getByRole('button', { name: 'Registrar diagnóstico', exact: true }), 'Registrar diagnóstico');
      await fill(mechanic, mechanic.getByRole('dialog').getByLabel('Descrição técnica', { exact: true }), 'Inspeção de demonstração: revisão preventiva e substituição de filtro e junta.', 'Descrição técnica');
      await mutation(mechanic, 'PATCH', '/diagnostico', () => click(mechanic, mechanic.getByRole('dialog').getByRole('button', { name: 'Salvar diagnóstico', exact: true }), 'Salvar diagnóstico'));
      await expect(mechanic.getByRole('dialog')).toHaveCount(0); await click(mechanic, mechanic.getByRole('tab', { name: 'Diagnóstico', exact: true }), 'Conferir diagnóstico'); await expect(mechanic.locator('#panel-diagnosis')).toContainText('revisão preventiva'); await shot(mechanic, '05-diagnosis');
      await click(mechanic, mechanic.getByRole('button', { name: 'Gerar orçamento', exact: true }), 'Gerar orçamento');
      await fill(mechanic, mechanic.locator('[name="groupTitle"]'), `Revisão preventiva ${prefix}`, 'Título do grupo'); await fill(mechanic, mechanic.locator('[name="description-1"]'), fixture.service.name, 'Serviço'); await fill(mechanic, mechanic.locator('[name="price-1"]'), '100', 'Valor do serviço');
      for (const [index, part] of fixture.parts.entries()) {
        const key = index + 2; await click(mechanic, mechanic.getByRole('button', { name: 'Adicionar item', exact: true }), 'Adicionar material'); await select(mechanic, mechanic.locator(`[name="type-${key}"]`), 'MATERIAL', 'Tipo material'); await choose(mechanic, `#budget-piece-${key}-input`, part.code);
        await expect(mechanic.locator(`[name="description-${key}"]`)).toHaveValue(part.name); await expect(mechanic.locator(`[name="price-${key}"]`)).toHaveValue(part.price.toFixed(2)); await expect(mechanic.locator(`[name="quantity-${key}"]`)).toHaveValue('1');
      }
      await fill(mechanic, mechanic.locator('#budget-form [name="notasCliente"]'), `PÚBLICA ORÇAMENTO ${prefix}: revisão e materiais incluídos.`, 'Nota pública orçamento'); await fill(mechanic, mechanic.locator('#budget-form [name="notasInternas"]'), `PRIVADA ORÇAMENTO ${prefix}: revisar montagem antes da liberação.`, 'Nota interna orçamento');
      await expect(mechanic.locator('fieldset[data-line]')).toHaveCount(3); await expect(mechanic.locator('.budget-total')).toContainText('175,00'); await shot(mechanic, '05-budget-175');
      await mutation(mechanic, 'PATCH', '/orcamento', () => click(mechanic, mechanic.getByRole('button', { name: 'Enviar ao cliente', exact: true }), 'Enviar orçamento uma vez')); await expect(mechanic.getByRole('dialog')).toHaveCount(0);
      const value = await eventually('Orçamento persistido', read, value => value.status === 'AGUARDANDO_APROVACAO' && value.orcamento?.total === 175);
      expect(value.orcamento.grupos[0].linhasServico.map(line => [line.quantidade, line.valorUnitario])).toEqual([[1, 100], [1, 50], [1, 25]]);
      await click(mechanic, mechanic.getByRole('tab', { name: /Orçamento/ }), 'Orçamento persistido'); await expect(mechanic.locator('#panel-budget')).toContainText('PRIVADA ORÇAMENTO'); await shot(mechanic, '05-budget-persisted'); passed(5, { total: 175, quantities: [1, 1, 1], unitPrices: [100, 50, 25], groupPreserved: true });
    });

    currentBlock = 6;
    await test.step('6 — Cliente aprova, falta compensa e consultor encaminha ao admin', async () => {
      await openOrder(client); await click(client, client.getByRole('tab', { name: /Orçamento/ }), 'Revisar orçamento do cliente'); await expect(client.locator('#panel-budget')).toContainText('175,00'); await expect(client.locator('#panel-budget')).toContainText('PÚBLICA ORÇAMENTO'); await expect(client.locator('body')).not.toContainText('PRIVADA'); await shot(client, '06-client-budget');
      await confirm(client, 'Aprovar orçamento'); await wait(client, 'Preparação termina compensada', () => expect(client.locator('#next-action-title')).toHaveText('Preparação cancelada', { timeout: 60_000 }));
      const value = await eventually('Aprovação preservada após compensação', read, value => value.preparacao === 'COMPENSATED'); firstSaga = value.sagaId;
      expect(value.status).toBe('APROVADA'); expect(value.orcamento.total).toBe(175); expect(value.orcamento.aprovadoEm).toBeTruthy(); expect(value.paymentConfirmed).toBe(false);
      for (const part of fixture.parts) { const balance = await stock(part); expect(balance.quantidadeDisponivel).toBe(part.initial); expect(balance.quantidadeReservada).toBe(0); expect(balance.quantidadeConsumida).toBe(0); }
      await openOrder(consultant); const shortage = consultant.getByRole('region', { name: 'Peças que impedem a preparação', exact: true });
      await expect(shortage).toContainText(fixture.parts[1].code); await expect(shortage).toContainText('Filial: filial-sp'); await expect(shortage).toContainText('Necessária: 1'); await expect(shortage).toContainText('Falta: 1'); await expect(shortage).toContainText('Solicite ao administrador'); await expect(shortage).not.toContainText('Disponível:');
      await expect(consultant.locator('.sidebar-nav').getByRole('link', { name: 'Estoque', exact: true })).toHaveCount(0); await expect(shortage.getByRole('link')).toHaveCount(0); await shot(consultant, '06-consultant-handoff');
      await step(consultant, 'navigation', 'Conferir restrição de estoque', () => consultant.goto(PORTAL + '/#/estoque')); await expect(consultant.locator('main')).toContainText(/não tem (?:acesso|permissão)/i); await shot(consultant, '06-consultant-stock-restricted'); await openOrder(consultant);
      await openOrder(admin); await click(admin, admin.getByRole('tab', { name: 'Histórico', exact: true }), 'Histórico de compensação'); await expect(admin.locator('#panel-history')).toContainText('SAGA COMPENSADA'); await shot(admin, '06-compensated-history');
      passed(6, { status: value.status, preparation: value.preparacao, sagaId: firstSaga, approvalPreserved: true, reservations: [0, 0], consultantStockAccess: false });
    });

    currentBlock = 7;
    await test.step('7 — Admin repõe B1 pelo contexto e libera nova Saga', async () => {
      await click(admin, admin.getByRole('link', { name: 'Consultar e repor nesta filial', exact: true }), 'Estoque contextual da falta'); await expect(admin.locator('#resource-search-input')).toHaveValue(fixture.parts[1].code); await expect(admin.locator('#resource-branch')).toHaveValue('filial-sp');
      const row = admin.locator('tbody tr').filter({ hasText: fixture.parts[1].code }); await expect(row).toHaveCount(1); await expect(row).toContainText('0 disponíveis'); await click(admin, row.getByRole('button', { name: 'Dar entrada', exact: true }), 'Dar entrada na junta correta');
      const dialog = admin.getByRole('dialog'); await fill(admin, dialog.getByLabel('Quantidade de entrada', { exact: false }), '1', 'Entrada de uma unidade'); await expect(dialog).toContainText('filial-sp'); await shot(admin, '07-restock-one');
      await mutation(admin, 'PATCH', '/entrada', () => click(admin, dialog.getByRole('button', { name: 'Registrar entrada', exact: true }), 'Registrar entrada uma vez')); await expect(dialog).toHaveCount(0); expect((await stock(fixture.parts[1])).quantidadeDisponivel).toBe(1);
      await openOrder(admin); await mutation(admin, 'POST', '/saga/retry', () => click(admin, admin.getByRole('button', { name: 'Tentar preparação novamente', exact: true }), 'Tentar preparação novamente (ação direta)'));
      const value = await eventually('Nova Saga conclui preparação', read, value => value.preparacao === 'COMPLETED'); recoveredSaga = value.sagaId; expect(recoveredSaga).not.toBe(firstSaga); expect(value.status).toBe('APROVADA'); expect(value.orcamento.total).toBe(175); expect(value.orcamento.aprovadoEm).toBeTruthy();
      for (const part of fixture.parts) { const balance = await stock(part); expect(balance.quantidadeDisponivel).toBe(0); expect(balance.quantidadeReservada).toBe(1); expect(balance.quantidadeConsumida).toBe(0); }
      await wait(admin, 'Diagnóstico da falta desaparece após recuperação', () => expect(admin.locator('.shortage-card')).toHaveCount(0, { timeout: 60_000 })); await click(admin, admin.getByRole('tab', { name: 'Histórico', exact: true }), 'Histórico da recuperação'); await expect(admin.locator('#panel-history')).toContainText('EXECUCAO LIBERADA'); await shot(admin, '07-preparation-recovered');
      passed(7, { sameOrder: order.numero, firstSaga, recoveredSaga, preparation: value.preparacao, restockQuantity: 1, reservedEach: 1 });
    });

    currentBlock = 8;
    await test.step('8 — Mecânico consome A1 e B1; entrega continua bloqueada', async () => {
      await openOrder(mechanic); await wait(mechanic, 'Execução liberada', () => expect(mechanic.getByRole('button', { name: 'Iniciar execução', exact: true })).toBeVisible({ timeout: 60_000 })); await confirm(mechanic, 'Iniciar execução');
      await wait(mechanic, 'Aguardar execução', () => expect(mechanic.getByRole('button', { name: 'Consumir peça', exact: true })).toBeVisible({ timeout: 60_000 }));
      for (const part of fixture.parts) {
        await click(mechanic, mechanic.getByRole('button', { name: 'Consumir peça', exact: true }), 'Consumir material'); const dialog = mechanic.getByRole('dialog'), selector = dialog.getByRole('combobox', { name: 'Peça do orçamento', exact: true });
        const label = (await selector.locator('option').allTextContents()).find(label => label.includes(part.code)); expect(label).toBeTruthy(); await select(mechanic, selector, { label }, 'Selecionar material por código e nome'); await expect(dialog.locator('[data-consumption-balance]')).toHaveText('Reservada: 1 · Consumida: 0 · Restante: 1'); await fill(mechanic, dialog.getByLabel('Quantidade', { exact: true }), '1', 'Consumir uma unidade');
        await shot(mechanic, '08-consume-' + part.code.slice(-1)); await mutation(mechanic, 'PATCH', '/consumo-peca', () => click(mechanic, dialog.getByRole('button', { name: 'Registrar consumo', exact: true }), 'Registrar consumo uma vez')); await expect(dialog).toHaveCount(0);
      }
      const value = await eventually('Consumos por OS sincronizados', read, value => value.consumosPeca?.length === 2 && value.consumosPeca.every(part => part.quantidadeConsumida === 1 && part.quantidadeRestante === 0));
      expect(value.consumosPeca.map(part => part.quantidadeReservada)).toEqual([1, 1]);
      for (const part of fixture.parts) { const balance = await stock(part); expect(balance.quantidadeDisponivel).toBe(0); expect(balance.quantidadeReservada).toBe(0); expect(balance.quantidadeConsumida).toBe(1); }
      await expect(mechanic.locator('.piece-balance')).toHaveCount(2); await shot(mechanic, '08-consumption-complete'); await confirm(mechanic, 'Finalizar serviço'); await wait(mechanic, 'Aguardar pagamento', () => expect(mechanic.locator('.page-header .status-badge')).toContainText('Aguardando pagamento', { timeout: 60_000 }));
      await openOrder(consultant); await expect(consultant.getByRole('button', { name: 'Registrar entrega', exact: true })).toHaveCount(0); expect((await read()).paymentConfirmed).toBe(false); await shot(consultant, '08-delivery-blocked'); passed(8, { consumedEach: 1, remainingEach: 0, deliveryBeforePayment: false });
    });

    currentBlock = 9;
    await test.step('9 — Cliente paga no simulador e consultor entrega a mesma OS', async () => {
      await openOrder(client); await wait(client, 'Checkout preparado', () => expect(client.getByRole('button', { name: 'Pagar OS', exact: true })).toBeVisible({ timeout: 60_000 }));
      await click(client, client.getByRole('button', { name: 'Pagar OS', exact: true }), 'Pagar OS'); await expect(client).toHaveURL(/http:\/\/localhost:8188\/checkout\//); await expect(client.locator('body')).toContainText('175,00'); await expect(client.locator('body')).toContainText('sem cobrança real'); await shot(client, '09-simulated-checkout');
      await click(client, client.getByRole('button', { name: 'Aprovar pagamento de demonstração', exact: true }), 'Aprovar pagamento simulado uma vez'); await wait(client, 'Retorno à mesma OS', () => expect(client).toHaveURL(PORTAL + '/#/ordens/' + order.id));
      const paid = await eventually('Pagamento confirmado e entrega liberada', read, value => value.status === 'PRONTA_PARA_ENTREGA' && value.paymentConfirmed === true); expect(paid.pagamento.status).toBe('APPROVED'); expect(paid.orcamento.total).toBe(175);
      await wait(consultant, 'Consultor recebe ação de entrega', () => expect(consultant.getByRole('button', { name: 'Registrar entrega', exact: true })).toBeVisible({ timeout: 60_000 })); await shot(consultant, '09-ready-for-delivery'); await confirm(consultant, 'Registrar entrega', 'Confirmar entrega'); await wait(consultant, 'Entrega persistida', () => expect(consultant.locator('.page-header .status-badge')).toContainText('Entregue', { timeout: 60_000 }));
      const delivered = await eventually('Ordem entregue', read, value => value.status === 'ENTREGUE'); expect(delivered.paymentConfirmed).toBe(true); expect(delivered.orcamento.total).toBe(175);
      await click(consultant, consultant.getByRole('tab', { name: 'Histórico', exact: true }), 'Histórico final'); await expect(consultant.locator('#panel-history')).toContainText('PAGAMENTO CONFIRMADO'); await expect(consultant.locator('#panel-history')).toContainText('VEICULO ENTREGUE'); await shot(consultant, '09-delivered-history');
      fs.writeFileSync(path.join(directory, 'final-order-verification.json'), JSON.stringify(delivered, null, 2)); passed(9, { number: order.numero, status: 'ENTREGUE', total: 175, payment: 'SIMULATED_APPROVED', returnedToSameOrder: true, deliveredBy: 'CONSULTOR_TECNICO', realMercadoPago: 'AWS_PENDING' });
    });

    currentBlock = 12; await shot(consultant, '12-local-conclusion'); passed(12, { localScope: 'Mesma OS entregue, valor 175 e histórico legíveis; publicação, RMs e links finais não executados.', number: order.numero });
    expect(browserErrors).toEqual([]);
    expect(requests.filter(request => request.method === 'POST' && request.path === '/api/v1/ordens-servico')).toHaveLength(1);
    expect(requests.filter(request => request.method === 'PATCH' && request.path.endsWith('/entrada'))).toHaveLength(1);
    expect(requests.filter(request => request.method === 'POST' && request.path.endsWith('/saga/retry'))).toHaveLength(1);
    expect(requests.filter(request => request.method === 'PATCH' && request.path.endsWith('/consumo-peca'))).toHaveLength(2);
    finished = true;
  } catch (error) {
    const block = blocks.find(block => block.block === currentBlock); if (block && !['AWS_PENDING', 'LOCAL_PASS'].includes(block.status)) Object.assign(block, { status: 'LOCAL_FAILED', error: error.message });
    log('failure', { message: error.message });
    for (const actor of actors) if (!actor.page.url().includes('/login')) await shot(actor.page, `failure-${actor.role}`).catch(() => {});
    throw error;
  } finally {
    const result = {
      run: process.env.VIDEO_REHEARSAL_RUN_ID, prefix, executedAt: new Date().toISOString(), project: PROJECT, portal: PORTAL,
      localJourney: finished ? 'LOCAL_PASS' : 'LOCAL_FAILED', awsReadiness: 'AWS_PENDING', videoRecorded: false,
      order: order ? { id: order.id, number: order.numero, firstSaga, recoveredSaga } : null,
      fixtures: fixture, blocks, browserErrors,
      metrics: { clicks: events.filter(event => event.kind === 'click').length, searches: events.filter(event => event.kind === 'search').length, navigations: events.filter(event => event.kind === 'navigation' || event.kind === 'click' && event.label?.startsWith('Navegar:')).length, uuidTranscriptions: 0, automationActionMs: events.filter(event => !['service-wait', 'verification-wait', 'fixture-api', 'verification-api'].includes(event.kind)).reduce((sum, event) => sum + (event.automationMs || 0), 0), explicitServiceWaitMs: events.filter(event => event.kind === 'service-wait').reduce((sum, event) => sum + (event.automationMs || 0), 0), note: 'Tempos de automação, não compreensão humana; requisições e espera de verificação separadas em events.jsonl.' },
      safeguards: { businessMutationsThroughUiOnly: true, apiAfterSetup: 'GET_ONLY', credentialsPersisted: false, traceHarVideo: 'OFF', demo5173Touched: false, cloudAccessed: false, serviceLifecycleChanged: false, historicalDataDeleted: false },
    };
    fs.writeFileSync(path.join(directory, 'rehearsal-results.json'), JSON.stringify(result, null, 2));
    await testInfo.attach('rehearsal-results', { path: path.join(directory, 'rehearsal-results.json'), contentType: 'application/json' });
    for (const actor of actors) await actor.context.close();
  }
});
