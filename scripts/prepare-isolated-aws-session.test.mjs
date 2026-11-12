import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm, chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { parseTemporaryCredentials, parseArgs, privateAccess, importSession, loadSession, isolatedSessionEnv, sessionPreflight } from './prepare-isolated-aws-session.mjs';

const script = fileURLToPath(new URL('./prepare-isolated-aws-session.mjs', import.meta.url));
const example = JSON.parse(await readFile(new URL('../docs/fase4/deploy-manifest.example.json', import.meta.url), 'utf8'));
const credentialValues = { aws_access_key_id: 'ASIA' + 'A'.repeat(16), aws_secret_access_key: 'b'.repeat(40), aws_session_token: 'c'.repeat(128) };
const ini = '[default]\n' + Object.entries(credentialValues).map(([key, value]) => `${key} = ${value}`).join('\n') + '\n';
async function withFixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'oficina-private-session-test-'));
  try {
    await privateAccess(root, { protect: true });
    const inputFile = join(root, 'private-input.ini');
    await writeFile(inputFile, ini, { mode: 0o600 });
    await run({ root, inputFile, directory: join(root, 'new-session') });
  } finally {
    assert.ok(resolve(root).startsWith(resolve(join(tmpdir(), 'oficina-private-session-test-'))));
    await rm(root, { recursive: true, force: true });
  }
}
function withoutValues(value) {
  for (const secret of Object.values(credentialValues)) assert.equal(JSON.stringify(value).includes(secret), false);
}

test('temporary INI intake accepts exactly one profile and refuses extras, duplicates and executable configuration', () => {
  assert.deepEqual(parseTemporaryCredentials(ini), credentialValues);
  assert.deepEqual(parseTemporaryCredentials(ini.replace('[default]', '[karina-lab]')), credentialValues);
  for (const text of [ini + '[another]\n', ini + `aws_access_key_id = ${credentialValues.aws_access_key_id}\n`, ini + 'region = us-east-1\n', ini + 'credential_process = command\n', ini + 'endpoint_url = https://untrusted.invalid\n', ini.replace('[default]', '[profile default]'), ini.replace('ASIA', 'AKIA'), ini.replace(/aws_session_token[^\n]+\n/, ''), ini + 'export AWS_ACCESS_KEY_ID=value\n', 'x'.repeat(65537)]) {
    assert.throws(() => parseTemporaryCredentials(text), error => { withoutValues(error.message); return true; });
  }
});

test('default/describe is offline and reveals no inherited credentials or file contents', () => {
  for (const args of [[], ['--describe']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, AWS_ACCESS_KEY_ID: credentialValues.aws_access_key_id, AWS_SECRET_ACCESS_KEY: credentialValues.aws_secret_access_key, AWS_SESSION_TOKEN: credentialValues.aws_session_token, AWS_SHARED_CREDENTIALS_FILE: 'must-not-be-read', AWS_CONFIG_FILE: 'must-not-be-read' } });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.mode, 'describe'); assert.equal(output.awsCalled, false); assert.equal(output.writes, false);
    withoutValues(result.stdout + result.stderr);
  }
  for (const args of [['--apply'], ['--preflight'], ['--directory', '/tmp/a'], ['--describe', '--preflight'], ['--import-file', '/tmp/a', '--directory', '/tmp/b', '--manifest', '/tmp/c'], ['--directory', '/tmp/a', '--directory', '/tmp/b']]) assert.throws(() => parseArgs(args));
});

test('isolated environment removes credentials, endpoints, web identity and fallback profiles', () => {
  const directory = resolve(tmpdir(), 'isolated-session-fixture');
  const env = isolatedSessionEnv(directory, { PATH: 'keep-path', AWS_ACCESS_KEY_ID: credentialValues.aws_access_key_id, AWS_SECRET_ACCESS_KEY: credentialValues.aws_secret_access_key, AWS_SESSION_TOKEN: credentialValues.aws_session_token, AWS_PROFILE: 'default', AWS_DEFAULT_PROFILE: 'old', AWS_ENDPOINT_URL: 'https://old.invalid', AWS_ENDPOINT_URL_STS: 'https://old-sts.invalid', AWS_WEB_IDENTITY_TOKEN_FILE: '/old/token', AWS_ROLE_ARN: 'old-role', AWS_CONTAINER_CREDENTIALS_FULL_URI: 'http://old-container', AWS_CA_BUNDLE: '/old/ca', amazon_access_key_id: 'old', BOTO_CONFIG: '/old/boto' });
  assert.equal(env.PATH, 'keep-path');
  assert.equal(env.AWS_PROFILE, 'karina-lab'); assert.equal(env.AWS_DEFAULT_PROFILE, 'karina-lab');
  assert.equal(env.AWS_SHARED_CREDENTIALS_FILE, join(directory, 'credentials'));
  assert.equal(env.AWS_CONFIG_FILE, join(directory, 'config'));
  assert.equal(env.AWS_EC2_METADATA_DISABLED, 'true'); assert.equal(env.AWS_IGNORE_CONFIGURED_ENDPOINT_URLS, 'true');
  for (const key of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_ENDPOINT_URL', 'AWS_ENDPOINT_URL_STS', 'AWS_WEB_IDENTITY_TOKEN_FILE', 'AWS_ROLE_ARN', 'AWS_CONTAINER_CREDENTIALS_FULL_URI', 'AWS_CA_BUNDLE', 'amazon_access_key_id', 'BOTO_CONFIG']) assert.equal(Object.hasOwn(env, key), false, key);
  withoutValues(env);
});

test('real private import preserves source/default, refuses overwrite and loads only the isolated profile', async () => withFixture(async fixture => {
  const before = await readFile(fixture.inputFile, 'utf8');
  const result = await importSession(fixture);
  assert.equal(result.awsCalled, false); assert.equal(result.awsVerified, false); assert.equal(result.expiresAt, null);
  assert.equal(result.expirationStatus, 'unknown-renew-before-deploy'); withoutValues(result);
  assert.deepEqual((await readdir(fixture.directory)).sort(), ['config', 'credentials', 'session.json']);
  const session = await loadSession(fixture.directory, { AWS_PROFILE: 'default', AWS_ACCESS_KEY_ID: 'old' });
  assert.equal(session.env.AWS_PROFILE, 'karina-lab');
  assert.equal(Object.hasOwn(session.env, 'AWS_ACCESS_KEY_ID'), false);
  assert.equal(await readFile(fixture.inputFile, 'utf8'), before);
  assert.ok((await readFile(join(fixture.directory, 'credentials'), 'utf8')).startsWith('[karina-lab]\n'));
  await assert.rejects(importSession(fixture), /NEW_SESSION_DIRECTORY_REQUIRED/);
  assert.equal(await readFile(fixture.inputFile, 'utf8'), before);
}));

test('paths inside any workspace repo and broad input permissions are refused without import', async () => withFixture(async fixture => {
  await assert.rejects(importSession({ inputFile: script, directory: fixture.directory }), /PRIVATE_FILES_MUST_BE_OUTSIDE_WORKSPACE/);
  await assert.rejects(importSession({ inputFile: fixture.inputFile, directory: join(fileURLToPath(new URL('./', import.meta.url)), 'must-not-create-private-session') }), /PRIVATE_FILES_MUST_BE_OUTSIDE_WORKSPACE/);
  if (process.platform === 'win32') {
    execFileSync('icacls.exe', [fixture.inputFile, '/grant', '*S-1-1-0:(R)'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  } else await chmod(fixture.inputFile, 0o644);
  await assert.rejects(importSession(fixture), /PRIVATE_WINDOWS_ACL_REQUIRED|PRIVATE_OWNER_PERMISSIONS_REQUIRED/);
  assert.deepEqual(await readdir(fixture.root), ['private-input.ini']);
}));

test('tampered profile/config and unconfirmed account prevent all preflight execution', async () => withFixture(async fixture => {
  await importSession(fixture);
  let calls = 0;
  await assert.rejects(sessionPreflight({ directory: fixture.directory, manifest: example, exec: async () => { calls++; } }), /EXPECTED_ACCOUNT_REQUIRED/);
  assert.equal(calls, 0);
  const manifest = structuredClone(example); manifest.scope.awsAccountId = '111111111111';
  await writeFile(join(fixture.directory, 'config'), '[profile karina-lab]\ncredential_process = untrusted\n');
  await assert.rejects(sessionPreflight({ directory: fixture.directory, manifest, exec: async () => { calls++; } }), /ISOLATED_CONFIG_REQUIRED/);
  assert.equal(calls, 0);
}));

test('preflight uses only isolated files; wrong account stops after STS and valid partial discovery retains review status', async () => withFixture(async fixture => {
  await importSession(fixture);
  const manifest = structuredClone(example); manifest.scope.awsAccountId = '111111111111';
  const calls = [];
  const exec = async (command, args, options) => {
    calls.push({ command, args, env: options.env });
    assert.equal(command, 'aws'); assert.ok(args.includes('--profile') && args.includes('karina-lab'));
    assert.equal(options.env.AWS_SHARED_CREDENTIALS_FILE, join(fixture.directory, 'credentials'));
    assert.equal(Object.hasOwn(options.env, 'AWS_ACCESS_KEY_ID'), false);
    withoutValues(args);
    return { stdout: JSON.stringify(args[0] === 'sts' ? { Account: calls.length === 1 ? '222222222222' : '111111111111' } : []) };
  };
  await assert.rejects(sessionPreflight({ directory: fixture.directory, manifest, inherited: { AWS_ACCESS_KEY_ID: 'old', AWS_ENDPOINT_URL: 'http://old' }, exec }), /CALLER_ACCOUNT_MISMATCH/);
  assert.equal(calls.length, 1);
  const report = await sessionPreflight({ directory: fixture.directory, manifest, inherited: { AWS_ACCESS_KEY_ID: 'old' }, exec });
  assert.equal(report.mode, 'aws-read-only'); assert.equal(report.requiresReview, true);
  assert.ok(report.missingInputs.includes('roles.node'));
  assert.equal(report.session.expirationStatus, 'unknown-renew-before-deploy'); withoutValues(report);
}));

test('CLI failures never echo private source path or supplied material', () => {
  const result = spawnSync(process.execPath, [script, '--import-file', join(tmpdir(), 'PRIVATE-SOURCE-DO-NOT-ECHO.ini'), '--directory', join(tmpdir(), 'private-target')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, ''); assert.equal(result.stderr.includes('PRIVATE-SOURCE-DO-NOT-ECHO'), false);
  withoutValues(result.stderr);
});
