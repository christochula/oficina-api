import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const execute = promisify(execFile);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export class PreflightError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = code => { throw new PreflightError(code); };
export const readOperations = new Set([
  'sts:get-caller-identity', 'ec2:describe-vpcs', 'ec2:describe-subnets',
  'iam:get-role', 'eks:describe-cluster-versions', 'eks:list-clusters',
  'rds:describe-db-instances', 'dynamodb:list-tables', 'sqs:list-queues',
  'ecr:describe-repositories', 's3api:head-bucket', 's3api:get-bucket-encryption',
  's3api:get-bucket-versioning', 's3api:get-public-access-block', 's3api:list-objects-v2',
]);
export const disallowedZoneIds = new Set(['use1-az3', 'usw1-az2', 'cac1-az3']);

// These are deployment metadata only. Credentials must never be supplied in the manifest.
export function validateManifest(manifest, { remote = false } = {}) {
  if (!object(manifest) || manifest.schemaVersion !== 1 || !object(manifest.scope) || !Array.isArray(manifest.bindings) || !Array.isArray(manifest.states)) fail('INVALID_MANIFEST');
  const scope = manifest.scope;
  if (scope.awsRegion !== 'us-east-1' || scope.environment !== 'homolog') fail('WORKFLOW_REGION_OR_ENVIRONMENT_MISMATCH');
  if (scope.awsAccountId !== null && !/^\d{12}$/.test(scope.awsAccountId ?? '')) fail('INVALID_EXPECTED_ACCOUNT');
  if (remote && scope.awsAccountId === null) fail('EXPECTED_ACCOUNT_REQUIRED_BEFORE_AWS');
  const bucket = scope.awsAccountId ? `oficina-tc3-tfstate-${scope.awsAccountId}` : null;
  if (scope.stateBucket !== null && scope.stateBucket !== bucket) fail('STATE_BUCKET_MUST_MATCH_EXPECTED_ACCOUNT');
  if (scope.kubernetesVersion !== null && !/^1\.\d+$/.test(scope.kubernetesVersion ?? '')) fail('INVALID_KUBERNETES_VERSION');
  if (!object(scope.roles) || !['cluster', 'node', 'principal', 'lambda'].every(name => Object.hasOwn(scope.roles, name))) fail('ROLE_METADATA_REQUIRED');
  for (const arn of Object.values(scope.roles)) {
    if (arn !== null && (!scope.awsAccountId || !new RegExp(`^arn:aws:iam::${scope.awsAccountId}:role/[A-Za-z0-9+=,.@_/-]+$`).test(arn))) fail('ROLE_ACCOUNT_MISMATCH');
  }
  const destinations = new Set(['oficina-api', 'oficina-auth-serverless', 'oficina-billing-service', 'oficina-production-service', 'oficina-infra-kubernetes', 'oficina-infra-database']);
  for (const binding of manifest.bindings) {
    if (!object(binding) || !['environmentVariable', 'repositoryVariable', 'environmentSecret', 'repositorySecret'].includes(binding.kind) || !Array.isArray(binding.names) || binding.names.length === 0 || binding.names.some(name => !/^[A-Z][A-Z0-9_]+$/.test(name)) || !Array.isArray(binding.destinations) || binding.destinations.some(repo => !destinations.has(repo)) || typeof binding.source !== 'string' || typeof binding.stage !== 'string') fail('INVALID_BINDING');
    if (binding.kind.endsWith('Secret') && Object.keys(binding).some(key => !['kind', 'names', 'destinations', 'source', 'stage'].includes(key))) fail('SECRET_VALUES_FORBIDDEN');
  }
  if (new Set(manifest.states.map(state => state.key)).size !== manifest.states.length || manifest.states.some(state => !/^[a-z0-9/-]+\.tfstate$/.test(state.key ?? ''))) fail('INVALID_STATE_KEYS');
  if (JSON.stringify(manifest).match(/(?:AKIA|ASIA)[A-Z0-9]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----/)) fail('CREDENTIAL_MATERIAL_FORBIDDEN');
  const missing = ['awsAccountId', 'kubernetesVersion'].filter(name => scope[name] === null);
  for (const [name, value] of Object.entries(scope.roles)) if (value === null) missing.push(`roles.${name}`);
  return { scope, bucket, missing };
}

function safeError(error) {
  if (error instanceof PreflightError) return error.code;
  const code = String(error?.stderr ?? '').match(/\((AccessDenied(?:Exception)?|UnauthorizedOperation|ExpiredToken(?:Exception)?|InvalidClientTokenId|UnrecognizedClientException|NoSuchBucket|404|403|NoSuchEntity|ThrottlingException)\)/)?.[1];
  return code ?? 'AWS_READ_UNAVAILABLE';
}

export function awsReader({ region, profile, env = process.env, exec = execute }) {
  if (region !== 'us-east-1' || profile && !/^[A-Za-z0-9_.-]+$/.test(profile)) fail('INVALID_CLI_SCOPE');
  return async args => {
    if (!readOperations.has(`${args[0]}:${args[1]}`) || args.some(arg => arg === '--endpoint-url' || arg === '--debug' || arg === '--cli-input-json' || arg === '--cli-input-yaml')) fail('READ_ONLY_OPERATION_REQUIRED');
    const result = await exec('aws', [...args, '--region', region, '--output', 'json', '--no-cli-pager', '--no-cli-auto-prompt', ...(profile ? ['--profile', profile] : [])], {
      encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024,
      env: { ...env, AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off', AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'true' },
    });
    try { return JSON.parse(result.stdout || '{}'); } catch { fail('INVALID_AWS_READ_JSON'); }
  };
}

export async function preflightAccount(manifest, read) {
  const { scope, bucket, missing } = validateManifest(manifest, { remote: true });
  if (typeof read !== 'function') fail('READ_EXECUTOR_REQUIRED');
  const checks = [];
  // Identity must be the only operation allowed before the account is proven.
  let identity;
  try { identity = await read(['sts', 'get-caller-identity']); } catch (error) { fail(safeError(error)); }
  if (identity.Account !== scope.awsAccountId) fail('CALLER_ACCOUNT_MISMATCH_NO_FURTHER_READS');
  checks.push({ name: 'account', status: 'PASS', accountId: identity.Account });
  async function check(name, args, inspect = () => ({ status: 'PASS' })) {
    try { const value = await read(args); const result = inspect(value); checks.push({ name, ...result }); return value; }
    catch (error) { const code = safeError(error); checks.push({ name, status: ['NoSuchBucket', '404', 'NoSuchEntity'].includes(code) ? 'ABSENT' : 'UNKNOWN', code }); return undefined; }
  }
  if (scope.kubernetesVersion) await check('eksVersion', ['eks', 'describe-cluster-versions', '--cluster-versions', scope.kubernetesVersion], value => ({ status: value.clusterVersions?.[0]?.versionStatus === 'STANDARD_SUPPORT' ? 'PASS' : 'FAIL', code: value.clusterVersions?.[0]?.versionStatus === 'STANDARD_SUPPORT' ? 'STANDARD_SUPPORT' : 'VERSION_NOT_IN_STANDARD_SUPPORT' }));
  const vpcs = await check('defaultVpc', ['ec2', 'describe-vpcs', '--filters', 'Name=is-default,Values=true', '--query', 'Vpcs[].VpcId'], value => ({ status: Array.isArray(value) && value.length === 1 ? 'PASS' : 'FAIL', code: Array.isArray(value) && value.length === 1 ? 'DEFAULT_VPC_FOUND' : 'DEFAULT_VPC_REQUIRED' }));
  if (Array.isArray(vpcs) && vpcs.length === 1 && /^vpc-[a-f0-9]+$/.test(vpcs[0])) {
    await check('subnets', ['ec2', 'describe-subnets', '--filters', `Name=vpc-id,Values=${vpcs[0]}`, '--query', 'Subnets[].{id:SubnetId,zone:AvailabilityZone,zoneId:AvailabilityZoneId,availableIps:AvailableIpAddressCount,publicIpOnLaunch:MapPublicIpOnLaunch}'], value => {
      if (!Array.isArray(value)) fail('INVALID_SUBNET_METADATA');
      const eligible = value.filter(subnet => !disallowedZoneIds.has(subnet.zoneId));
      const enough = new Set(eligible.map(subnet => subnet.zoneId)).size >= 2 && eligible.every(subnet => subnet.availableIps >= 6 && subnet.publicIpOnLaunch === true);
      return { status: enough ? 'PASS' : 'FAIL', code: enough ? 'SUPPORTED_DEFAULT_SUBNETS' : 'REVIEW_AZS_IPS_AND_PUBLIC_NODE_CONNECTIVITY', subnets: value.map(subnet => ({ ...subnet, eligible: !disallowedZoneIds.has(subnet.zoneId) })) };
    });
  }
  for (const [purpose, arn] of Object.entries(scope.roles)) {
    if (!arn) continue;
    await check(`role.${purpose}`, ['iam', 'get-role', '--role-name', arn.split('/').at(-1), '--query', '{arn:Role.Arn,principals:Role.AssumeRolePolicyDocument.Statement[].Principal}'], value => ({ status: value.arn === arn ? 'PASS' : 'FAIL', code: value.arn === arn ? 'ROLE_EXISTS_PERMISSIONS_STILL_REQUIRE_REVIEW' : 'ROLE_IDENTITY_MISMATCH' }));
  }
  const bucketCheck = await check('stateBucket', ['s3api', 'head-bucket', '--bucket', bucket, '--expected-bucket-owner', scope.awsAccountId]);
  if (bucketCheck !== undefined) {
    const ownerArgs = ['--bucket', bucket, '--expected-bucket-owner', scope.awsAccountId];
    await check('stateVersioning', ['s3api', 'get-bucket-versioning', ...ownerArgs], value => ({ status: value.Status === 'Enabled' ? 'PASS' : 'FAIL' }));
    await check('stateEncryption', ['s3api', 'get-bucket-encryption', ...ownerArgs], value => ({ status: value.ServerSideEncryptionConfiguration?.Rules?.some(rule => ['AES256', 'aws:kms'].includes(rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm)) ? 'PASS' : 'FAIL' }));
    await check('statePublicBlock', ['s3api', 'get-public-access-block', ...ownerArgs], value => ({ status: ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'].every(name => value.PublicAccessBlockConfiguration?.[name] === true) ? 'PASS' : 'FAIL' }));
    const stateKeys = [];
    for (const prefix of ['oficina/', 'oficina-fase4/']) {
      const keys = await check(`stateMetadata.${prefix}`, ['s3api', 'list-objects-v2', ...ownerArgs, '--prefix', prefix, '--query', 'Contents[].Key'], value => ({ status: Array.isArray(value) || value === null ? 'PASS' : 'FAIL' }));
      if (Array.isArray(keys)) stateKeys.push(...keys.filter(key => typeof key === 'string' && key.endsWith('.tfstate')));
    }
    checks.push({ name: 'stateOwnership', status: stateKeys.length ? 'REVIEW' : 'PASS', keys: stateKeys, code: stateKeys.includes('oficina/homolog/observability.tfstate') ? 'LEGACY_OBSERVABILITY_KEY_REQUIRES_RECONCILIATION' : stateKeys.length ? 'EXISTING_STATES_MUST_NOT_BE_OVERWRITTEN' : 'NO_EXISTING_STATE_KEYS' });
  }
  for (const [name, args] of [
    ['clusters', ['eks', 'list-clusters', '--query', 'clusters']],
    ['databases', ['rds', 'describe-db-instances', '--query', 'DBInstances[].DBInstanceIdentifier']],
    ['tables', ['dynamodb', 'list-tables', '--query', 'TableNames']],
    ['queues', ['sqs', 'list-queues', '--queue-name-prefix', 'oficina', '--query', 'QueueUrls']],
    ['repositories', ['ecr', 'describe-repositories', '--query', 'repositories[].repositoryName']],
  ]) await check(name, args, value => ({ status: Array.isArray(value) && value.length ? 'REVIEW' : 'PASS', count: Array.isArray(value) ? value.length : 0 }));
  return { schemaVersion: 1, mode: 'aws-read-only', accountId: scope.awsAccountId, region: scope.awsRegion, missingInputs: missing, checks, requiresReview: missing.length > 0 || checks.some(check => check.status !== 'PASS'), limitations: ['No write permissions, quotas or Lab credit validated.', 'No secret values or Terraform state bodies read.', 'No GitHub, Kubernetes, Mercado Pago or Datadog access.', 'No proof of existing Datadog resource ownership; reconcile its canonical state separately.'] };
}

async function main(args) {
  const options = { manifest: new URL('../docs/fase4/deploy-manifest.example.json', import.meta.url), aws: false };
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--aws') options.aws = true;
    else if (args[index] === '--manifest' && args[index + 1]) options.manifest = args[++index];
    else if (args[index] === '--profile' && args[index + 1]) options.profile = args[++index];
    else if (args[index] !== '--validate') fail('USAGE_VALIDATE_OR_AWS_WITH_MANIFEST_AND_OPTIONAL_PROFILE');
  }
  let manifest;
  try { manifest = JSON.parse(await readFile(options.manifest, 'utf8')); } catch { fail('MANIFEST_READ_OR_JSON_FAILED'); }
  const validation = validateManifest(manifest, { remote: options.aws });
  const result = options.aws
    ? await preflightAccount(manifest, awsReader({ region: manifest.scope.awsRegion, profile: options.profile }))
    : { mode: 'offline', validTemplate: true, missingInputs: validation.missing, awsCalled: false };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (options.aws && result.requiresReview) process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => { process.stderr.write(`Preflight failed: ${safeError(error)}\n`); process.exitCode = 1; });
}
