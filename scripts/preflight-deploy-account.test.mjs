import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { awsReader, preflightAccount, readOperations, validateManifest } from './preflight-deploy-account.mjs';

const example = JSON.parse(await readFile(new URL('../docs/fase4/deploy-manifest.example.json', import.meta.url), 'utf8'));
const account = '111111111111';
function manifest() {
  const result = structuredClone(example);
  result.scope.awsAccountId = account;
  result.scope.kubernetesVersion = '1.35';
  for (const name of Object.keys(result.scope.roles)) result.scope.roles[name] = `arn:aws:iam::${account}:role/LabRole`;
  return result;
}
function fixture(overrides = {}) {
  const calls = [];
  const responses = {
    'sts:get-caller-identity': { Account: account },
    'eks:describe-cluster-versions': { clusterVersions: [{ versionStatus: 'STANDARD_SUPPORT' }] },
    'ec2:describe-vpcs': ['vpc-00000001'],
    'ec2:describe-subnets': [
      { id: 'subnet-00000001', zone: 'us-east-1a', zoneId: 'use1-az3', availableIps: 100, publicIpOnLaunch: true },
      { id: 'subnet-00000002', zone: 'us-east-1e', zoneId: 'use1-az1', availableIps: 100, publicIpOnLaunch: true },
      { id: 'subnet-00000003', zone: 'us-east-1b', zoneId: 'use1-az2', availableIps: 100, publicIpOnLaunch: true },
    ],
    'iam:get-role': { arn: `arn:aws:iam::${account}:role/LabRole` },
    's3api:head-bucket': {},
    's3api:get-bucket-versioning': { Status: 'Enabled' },
    's3api:get-bucket-encryption': { ServerSideEncryptionConfiguration: { Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }] } },
    's3api:get-public-access-block': { PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true } },
    ...overrides,
  };
  return { calls, read: async args => {
    calls.push(args);
    const operation = `${args[0]}:${args[1]}`;
    assert.ok(readOperations.has(operation), `Unexpected AWS operation ${operation}`);
    if (responses[operation] instanceof Error) throw responses[operation];
    return responses[operation] ?? [];
  } };
}

test('example validates offline without inventing account or credential values', () => {
  const result = validateManifest(example);
  assert.equal(result.bucket, null);
  assert.ok(result.missing.includes('awsAccountId'));
  assert.equal(example.decisions.deployLegacyDatabase, false);
  assert.equal(example.decisions.datadogObservabilityMode, 'agent-only');
  for (const binding of example.bindings.filter(item => item.kind.endsWith('Secret'))) assert.equal(Object.hasOwn(binding, 'value'), false);
});

test('missing account, old-account roles/bucket and supplied credentials are rejected before any AWS read', async () => {
  const cases = [structuredClone(example), manifest(), manifest(), manifest()];
  cases[1].scope.roles.node = 'arn:aws:iam::222222222222:role/LabRole';
  cases[2].scope.stateBucket = 'oficina-tc3-tfstate-222222222222';
  cases[3].bindings.find(item => item.kind === 'environmentSecret').value = 'never-print-this';
  for (const invalid of cases) {
    const { calls, read } = fixture();
    await assert.rejects(preflightAccount(invalid, read), /EXPECTED_ACCOUNT_REQUIRED|ROLE_ACCOUNT_MISMATCH|STATE_BUCKET_MUST_MATCH|SECRET_VALUES_FORBIDDEN/);
    assert.equal(calls.length, 0);
  }
});

test('wrong current account stops after identity; CLI error text is never reflected', async () => {
  let f = fixture({ 'sts:get-caller-identity': { Account: '222222222222' } });
  await assert.rejects(preflightAccount(manifest(), f.read), /CALLER_ACCOUNT_MISMATCH/);
  assert.equal(f.calls.length, 1);
  f = fixture({ 'sts:get-caller-identity': Object.assign(new Error('private-output'), { stderr: 'private-output An error occurred (ExpiredToken) when calling GetCallerIdentity' }) });
  await assert.rejects(preflightAccount(manifest(), f.read), error => error.message === 'ExpiredToken');
  assert.equal(f.calls.length, 1);
});

test('read-only metadata checks select physical zones, verify protected state and disclose limitations', async () => {
  const { calls, read } = fixture();
  const result = await preflightAccount(manifest(), read);
  assert.equal(result.requiresReview, false);
  const subnets = result.checks.find(check => check.name === 'subnets').subnets;
  assert.equal(subnets[0].eligible, false, 'use1-az3 is forbidden even when named 1a');
  assert.equal(subnets[1].eligible, true, '1e is allowed when its physical zone is supported');
  assert.ok(calls.filter(args => args[0] === 's3api').every(args => args.includes('--expected-bucket-owner') && args.includes(account)));
  assert.ok(calls.every(args => readOperations.has(`${args[0]}:${args[1]}`)));
  assert.ok(!calls.some(args => args.includes('get-secret-value') || args.includes('get-object')));
  assert.ok(result.limitations.some(item => item.includes('No write permissions')));
});

test('absence differs from denial and an existing or legacy observability state always requires reconciliation', async () => {
  for (const [code, status] of [['404', 'ABSENT'], ['403', 'UNKNOWN']]) {
    const f = fixture({ 's3api:head-bucket': Object.assign(new Error('masked'), { stderr: `An error occurred (${code}) when calling HeadBucket` }) });
    const result = await preflightAccount(manifest(), f.read);
    assert.equal(result.checks.find(check => check.name === 'stateBucket').status, status);
    assert.equal(result.requiresReview, true);
    assert.ok(!f.calls.some(args => args[1] === 'get-bucket-versioning'));
  }
  const f = fixture({ 's3api:list-objects-v2': ['oficina/observability/terraform.tfstate', 'oficina/homolog/observability.tfstate'] });
  const result = await preflightAccount(manifest(), f.read);
  assert.equal(result.checks.find(check => check.name === 'stateOwnership').code, 'LEGACY_OBSERVABILITY_KEY_REQUIRES_RECONCILIATION');
  assert.equal(result.requiresReview, true);
});

test('unsupported version, inadequate network and inaccessible role cannot produce a ready result', async () => {
  const f = fixture({
    'eks:describe-cluster-versions': { clusterVersions: [{ versionStatus: 'EXTENDED_SUPPORT' }] },
    'ec2:describe-subnets': [{ id: 'subnet-00000001', zoneId: 'use1-az1', availableIps: 2, publicIpOnLaunch: false }],
    'iam:get-role': Object.assign(new Error('private'), { stderr: 'An error occurred (AccessDenied) when calling GetRole' }),
  });
  const result = await preflightAccount(manifest(), f.read);
  assert.equal(result.requiresReview, true);
  assert.equal(result.checks.find(check => check.name === 'eksVersion').status, 'FAIL');
  assert.equal(result.checks.find(check => check.name === 'subnets').status, 'FAIL');
  assert.equal(result.checks.find(check => check.name === 'role.node').status, 'UNKNOWN');
  assert.equal(JSON.stringify(result).includes('private'), false);
});

test('CLI wrapper refuses mutations, secret/state payload reads and endpoint injection', async () => {
  const calls = [];
  const read = awsReader({ region: 'us-east-1', profile: 'karina-lab', env: { AWS_ENDPOINT_URL: 'http://old-host.invalid' }, exec: async (...args) => { calls.push(args); return { stdout: '{}' }; } });
  for (const args of [['s3api', 'create-bucket'], ['secretsmanager', 'get-secret-value'], ['s3api', 'get-object'], ['ec2', 'reboot-instances'], ['sts', 'get-caller-identity', '--endpoint-url', 'http://old-host.invalid']]) await assert.rejects(read(args), /READ_ONLY_OPERATION_REQUIRED/);
  assert.equal(calls.length, 0);
  await read(['sts', 'get-caller-identity']);
  assert.equal(calls[0][0], 'aws');
  assert.ok(calls[0][1].includes('karina-lab'));
  assert.equal(calls[0][2].env.AWS_IGNORE_CONFIGURED_ENDPOINT_URLS, 'true');
  assert.equal(calls[0][2].windowsHide, true);
});
