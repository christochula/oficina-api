import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import runner from './local-phase4.cjs';

test('demo and tests use distinct projects, ports and local URLs', () => {
  const demo = runner.configuration(false, {});
  const tests = runner.configuration(true, {});
  assert.equal(demo.project, 'oficina-phase4-demo');
  assert.equal(tests.project, 'oficina-phase4-test-local');
  assert.equal(demo.env.OS_TEST_URL, 'http://localhost:3000');
  assert.equal(tests.env.OS_TEST_URL, 'http://localhost:3100');
  assert.equal(tests.env.MP_TEST_URL, 'http://localhost:8188');
  assert.equal(tests.env.MANUAL_PORTAL_URL, 'http://localhost:5273');
  for (const port of Object.values(tests.ports)) assert.ok(!Object.values(demo.ports).includes(port));
});

test('test cleanup cannot be directed at demo or old existing project', () => {
  for (const project of ['oficina-phase4-demo', 'oficina-phase4', 'oficina-fase4', '../demo', 'test;echo']) {
    assert.throws(() => runner.configuration(true, { COMPOSE_PROJECT_NAME: project }), /Projeto recusado/);
  }
  assert.throws(() => runner.configuration(false, { PHASE4_COMPOSE_PROJECT: 'oficina-phase4-test-local' }), /Projeto recusado/);
});

test('invalid or conflicting port overrides fail before Docker is invoked', () => {
  for (const value of ['3000', '80', '65536', '3100.5', 'nope']) {
    assert.throws(() => runner.configuration(true, { PHASE4_BILLING_PORT: value }), /Porta|portas/);
  }
  assert.throws(() => runner.configuration(true, { PHASE4_BILLING_PORT: '3100' }), /diferentes/);
});

test('runtime resolves all service targets to loopback even if external test URLs are inherited', () => {
  const tests = runner.configuration(true, { OS_TEST_URL: 'https://external.invalid', MP_TEST_URL: 'https://provider.invalid', VITE_DEV_API_TARGET: 'https://aws.invalid' });
  assert.equal(tests.env.OS_TEST_URL, 'http://localhost:3100');
  assert.equal(tests.env.MP_TEST_URL, 'http://localhost:8188');
  assert.equal(tests.env.VITE_DEV_API_TARGET, 'http://localhost:3100');
});

test('npm CLI resolves the Windows installation and the Linux setup-node layout without a shell', () => {
  const execPath = path.resolve('runtime', 'bin', 'node');
  const windowsCli = path.join(path.dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const linuxCli = path.resolve(path.dirname(execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  assert.equal(runner.resolveNpmCli({ execPath, npmExecPath: '', exists: candidate => candidate === windowsCli }), windowsCli);
  assert.equal(runner.resolveNpmCli({ execPath, npmExecPath: '', exists: candidate => candidate === linuxCli }), linuxCli);
  assert.throws(() => runner.resolveNpmCli({ execPath, npmExecPath: '', exists: () => false }), /instalação Node/);
});

test('npm CLI honors the npm lifecycle executable when available', () => {
  const cli = path.resolve('npm', 'bin', 'npm-cli.js');
  assert.equal(runner.resolveNpmCli({ npmExecPath: cli, exists: candidate => candidate === cli }), cli);
});
