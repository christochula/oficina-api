// Restricted to the local Compose stack: never use these fixtures in AWS.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const adminPassword = 'Local-only-admin-password-2026';
const mechanicEmail = 'mecanico.local@example.com';
const mechanicPassword = 'Local-only-mechanic-password';
const apiUrl = new URL(process.env.OS_TEST_URL || 'http://localhost:3000');
if (apiUrl.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(apiUrl.hostname) || apiUrl.username || apiUrl.password || apiUrl.pathname !== '/' || apiUrl.search || apiUrl.hash) {
  throw new Error('OS_TEST_URL must be an HTTP localhost origin.');
}
const project = process.env.PHASE4_COMPOSE_PROJECT || process.env.COMPOSE_PROJECT_NAME || 'oficina-phase4-demo';
if (!/^oficina-phase4-(?:demo|test-[a-z0-9-]+|ci-[a-z0-9-]+)$/.test(project)) throw new Error('Use an isolated phase4 demo/test Compose project.');

async function request(resource, token, body, method = 'GET', missing = false) {
  const response = await fetch(`${apiUrl.origin}/api/v1${resource}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  if (missing && response.status === 404) return null;
  if (!response.ok) throw new Error(`${method} ${resource}: HTTP ${response.status}. Verifique a pilha local; nenhum cadastro existente foi sobrescrito.`);
  const result = await response.json();
  return result.data ?? result;
}
const id = entity => typeof entity.id === 'string' ? entity.id : entity.id.valor;
const rows = value => Array.isArray(value) ? value : value.data ?? value.itens ?? [];

async function main() {
  execFileSync('docker', ['compose', '-p', project, '-f', 'compose.phase4.yml', 'exec', '-T', '-e', `ADMIN_SEED_PASSWORD=${adminPassword}`, 'os', 'npm', 'run', 'seed'], { cwd: root, stdio: 'pipe' });
  const admin = await request('/auth/login', null, { email: 'admin@oficina.com', senha: adminPassword }, 'POST');
  const token = admin.accessToken;
  const users = rows(await request(`/usuarios?busca=${encodeURIComponent(mechanicEmail)}`, token));
  const mechanic = users.find(user => user.email === mechanicEmail) ?? await request('/usuarios', token, {
    nome: 'Mecânico Local', email: mechanicEmail, senha: mechanicPassword, papel: 'MECANICO',
  }, 'POST');
  if (mechanic.papel !== 'MECANICO' || !mechanic.ativo) throw new Error('O usuário local existente não é um mecânico ativo. Nenhuma alteração foi feita nesse cadastro.');
  await request('/auth/login', null, { email: mechanicEmail, senha: mechanicPassword }, 'POST');

  const client = await request('/clientes/documento/52998224725', token, undefined, 'GET', true) ?? await request('/clientes', token, {
    tipoDoc: 'CPF', numeroDoc: '52998224725', nome: 'Cliente fictício Fase 4', email: 'cliente@example.com', telefone: '11999990000',
  }, 'POST');
  const vehicle = await request('/veiculos/placa/BRA2E19', token, undefined, 'GET', true) ?? await request('/veiculos', token, {
    placa: 'BRA2E19', renavam: '12345678901', chassi: '9BWZZZ377VT004251', marca: 'Fiat', modelo: 'Demo', ano: 2020, cor: 'Prata',
  }, 'POST');
  const catalog = rows(await request('/servicos-oficina?porPagina=100', token));
  if (!catalog.some(service => service.nome === 'Revisão local (demonstração)')) {
    await request('/servicos-oficina', token, { nome: 'Revisão local (demonstração)', descricao: 'Serviço fictício para demonstração no navegador', categoria: 'Demonstração' }, 'POST');
  }
  const pieces = [];
  for (const filialId of ['filial-sp', 'filial-rj']) {
    let piece;
    for (let pagina = 1; ; pagina++) {
      const page = rows(await request(`/estoque?filialId=${filialId}&porPagina=100&pagina=${pagina}`, token));
      piece = page.find(item => item.peca.codigo === 'FILTRO-DEMO-LOCAL');
      if (piece || page.length < 100) break;
    }
    piece ??= await request('/estoque/pecas', token, { codigo: 'FILTRO-DEMO-LOCAL', nome: 'Filtro local (demonstração)', precoVenda: 50, filialId, quantidadeInicial: 20, quantidadeMinima: 2 }, 'POST');
    pieces.push({ filialId, pecaId: id(piece.peca), disponivel: piece.quantidadeDisponivel });
  }
  console.log(JSON.stringify({ status: 'Pronto: cadastros fictícios disponíveis; saldos e OS existentes preservados.', mechanicId: id(mechanic), clientId: id(client), vehicleId: id(vehicle), pieces }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
