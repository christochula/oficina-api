// All resources belong to a local Compose project. No AWS credentials are read.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function configuration(testMode = false, source = process.env) {
  const project = source.PHASE4_COMPOSE_PROJECT || source.COMPOSE_PROJECT_NAME || (testMode ? 'oficina-phase4-test-local' : 'oficina-phase4-demo');
  const valid = testMode ? /^oficina-phase4-(?:test|ci)-[a-z0-9-]+$/ : /^oficina-phase4-demo$/;
  if (!valid.test(project)) throw new Error(`Projeto recusado: ${project}. Use o projeto isolado de ${testMode ? 'testes' : 'demonstração'}.`);
  const defaults = testMode ? [3100, 3101, 3102, 4567, 8188, 5273] : [3000, 3001, 3002, 4566, 8088, 5173];
  const names = ['OS', 'BILLING', 'PRODUCTION', 'LOCALSTACK', 'MP', 'PORTAL'];
  const ports = Object.fromEntries(names.map((name, index) => {
    const port = Number(source[`PHASE4_${name}_PORT`] || defaults[index]);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`Porta inválida: PHASE4_${name}_PORT.`);
    return [name, port];
  }));
  if (new Set(Object.values(ports)).size !== names.length) throw new Error('As portas da pilha local devem ser diferentes.');
  if (testMode && Object.values(ports).some(port => [3000, 3001, 3002, 4566, 8088, 5173].includes(port))) {
    throw new Error('As portas de teste não podem usar as portas reservadas à demonstração.');
  }
  const urls = Object.fromEntries(names.map(name => [name, `http://localhost:${ports[name]}`]));
  const env = {
    ...source,
    COMPOSE_PROJECT_NAME: project,
    PHASE4_COMPOSE_PROJECT: project,
    ...Object.fromEntries(names.map(name => [`PHASE4_${name}_PORT`, String(ports[name])])),
    OS_TEST_URL: urls.OS,
    BILLING_TEST_URL: urls.BILLING,
    PRODUCTION_TEST_URL: urls.PRODUCTION,
    LOCALSTACK_TEST_URL: urls.LOCALSTACK,
    MP_TEST_URL: urls.MP,
    MANUAL_PORTAL_URL: urls.PORTAL,
    LOCAL_DEMO_PORT: String(ports.PORTAL),
    LOCAL_DEMO_MODE: 'true',
    VITE_API_BASE_URL: '/api/v1',
    VITE_CLIENT_AUTH_BASE_URL: '',
    VITE_DEV_API_TARGET: urls.OS,
    VITE_DEV_BILLING_TARGET: urls.BILLING,
    VITE_DEV_PRODUCTION_TARGET: urls.PRODUCTION,
    DD_TRACE_ENABLED: 'false',
    DD_METRICS_ENABLED: 'false',
  };
  return { project, ports, urls, env, testMode };
}

function run(command, args, config, capture = false) {
  const result = spawnSync(command, args, { cwd: root, env: config.env, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} falhou (${result.status}).${capture ? `\n${result.stderr || result.stdout}` : ''}`);
  return result.stdout || '';
}

function compose(config, ...args) {
  return run('docker', ['compose', '-p', config.project, '-f', 'compose.phase4.yml', ...args], config);
}

function resolveNpmCli({ execPath = process.execPath, npmExecPath = process.env.npm_execpath, exists = fs.existsSync } = {}) {
  const executableDirectory = path.dirname(execPath);
  const candidates = [
    npmExecPath,
    path.join(executableDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(executableDirectory, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(executableDirectory, '..', 'share', 'nodejs', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);
  const cli = candidates.find(candidate => exists(candidate));
  if (!cli) throw new Error('Execute este comando por npm (ou use uma instalação Node que inclua npm).');
  return cli;
}

function npm(config, ...args) {
  const cli = resolveNpmCli();
  return run(process.execPath, [cli, ...args], config);
}

async function ready(config) {
  const endpoints = [
    `${config.urls.OS}/api/health/ready`,
    `${config.urls.BILLING}/api/v1/billing/health`,
    `${config.urls.PRODUCTION}/api/v1/production/health`,
    `${config.urls.MP}/health`,
  ];
  for (const endpoint of endpoints) {
    const deadline = Date.now() + 180000;
    let healthy = false;
    while (Date.now() < deadline) {
      try { healthy = (await fetch(endpoint, { signal: AbortSignal.timeout(3000) })).ok; } catch { /* Service may still be starting. */ }
      if (healthy) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!healthy) throw new Error(`Readiness timeout: ${endpoint}. Consulte docker compose -p ${config.project} -f compose.phase4.yml logs.`);
    console.log(`Pronto: ${endpoint}`);
  }
}

async function up(config, build = true) {
  run('docker', ['info', '--format', '{{.ServerVersion}}'], config, true);
  // LocalStack 4.10 does not restore SQS messages. Preserve its container across
  // application rebuilds, including when a Compose healthcheck changes.
  compose(config, 'up', '-d', '--wait', '--wait-timeout', '180', '--no-recreate', 'os-db', 'billing-db', 'localstack', 'mercadopago');
  compose(config, 'up', '-d', '--no-deps', ...(build ? ['--build'] : []), 'os', 'billing', 'production');
  await ready(config);
  run(process.execPath, ['scripts/seed-local-demo.cjs'], config);
  console.log(`Pilha ${config.project} pronta. Portal: ${config.urls.PORTAL} (inicie ${config.testMode ? 'node scripts/local-phase4.cjs test-dev' : 'npm run local:dev'}).`);
}

function cleanup(config) {
  if (!config.testMode || !/^oficina-phase4-(?:test|ci)-[a-z0-9-]+$/.test(config.project)) throw new Error('Cleanup destrutivo recusado fora do projeto de testes.');
  const logs = spawnSync('docker', ['compose', '-p', config.project, '-f', 'compose.phase4.yml', 'logs', '--no-color'], { cwd: root, env: config.env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  fs.writeFileSync(path.join(root, 'phase4-compose.log'), (logs.stdout || '') + (logs.stderr || ''), 'utf8');
  compose(config, 'down', '-v', '--remove-orphans');
}

async function main(args = process.argv.slice(2)) {
  const command = args[0] || 'status';
  const testMode = command.startsWith('test-') || command === 'ci' || command === 'test';
  const config = configuration(testMode);
  if (command === 'env' || command === 'test-env') {
    const publicKeys = ['COMPOSE_PROJECT_NAME', 'PHASE4_COMPOSE_PROJECT', ...Object.keys(config.ports).map(name => `PHASE4_${name}_PORT`), 'OS_TEST_URL', 'BILLING_TEST_URL', 'PRODUCTION_TEST_URL', 'LOCALSTACK_TEST_URL', 'MP_TEST_URL', 'MANUAL_PORTAL_URL', 'LOCAL_DEMO_PORT', 'LOCAL_DEMO_MODE', 'VITE_API_BASE_URL', 'VITE_CLIENT_AUTH_BASE_URL', 'VITE_DEV_API_TARGET', 'VITE_DEV_BILLING_TARGET', 'VITE_DEV_PRODUCTION_TARGET'];
    console.log(JSON.stringify({ project: config.project, urls: config.urls, env: Object.fromEntries(publicKeys.map(key => [key, config.env[key]])) }, null, 2));
    return;
  }
  if (command === 'up' || command === 'test-up') return up(config, !args.includes('--no-build'));
  if (command === 'stop') {
    compose(config, 'stop', 'os', 'billing', 'production', 'mercadopago', 'os-db', 'billing-db');
    console.log('Aplicações pausadas. LocalStack permanece ativo para preservar as filas locais. Não encerre Docker Desktop com mensagens pendentes.');
    return;
  }
  if (command === 'test-stop') return compose(config, 'stop');
  if (command === 'status' || command === 'test-status') return compose(config, 'ps');
  if (command === 'seed' || command === 'test-seed') return run(process.execPath, ['scripts/seed-local-demo.cjs'], config);
  if (command === 'dev' || command === 'test-dev') {
    await ready(config);
    return npm(config, 'run', 'dev', '--prefix', 'frontend', '--', '--host', '127.0.0.1', '--port', String(config.ports.PORTAL));
  }
  if (command === 'test-clean') return cleanup(config);
  if (command !== 'test' && command !== 'ci') throw new Error('Comandos: up, dev, stop, status, seed, env, test-up, test-dev, test-stop, test-status, test-seed, test-env, test-clean, test, ci.');
  const suite = args[1] || 'all';
  if (!['all', 'bdd', 'frontend', 'resilience'].includes(suite)) throw new Error('Suíte inválida. Use all, bdd, frontend ou resilience.');
  try {
    await up(config, !args.includes('--no-build'));
    if (suite === 'all' || suite === 'bdd') npm(config, 'run', 'test:bdd');
    if (suite === 'all' || suite === 'frontend') {
      npm(config, 'run', 'test:frontend:e2e');
      npm({ ...config, env: { ...config.env, ALLOW_SERVICE_RESTART: 'true' } }, 'run', 'test:frontend:desktop');
    }
    if (suite === 'all' || suite === 'bdd' || suite === 'resilience') run(process.execPath, ['--test', 'test/phase4/resilience.cjs'], { ...config, env: { ...config.env, ALLOW_SERVICE_RESTART: 'true' } });
  } finally { cleanup(config); }
}

module.exports = { configuration, ready, resolveNpmCli };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
