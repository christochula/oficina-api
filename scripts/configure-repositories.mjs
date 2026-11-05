// Defaults to a reviewable dry run. Does not create repositories, push, merge or deploy.
// Official API: https://docs.github.com/en/rest/branches/branch-protection
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const arguments_ = process.argv.slice(2);
const apply = arguments_.includes('--apply');
const configIndex = arguments_.indexOf('--config');
const config = configIndex >= 0 ? JSON.parse(await readFile(arguments_[configIndex + 1], 'utf8')) : {};
const owner = config.owner ?? process.env.GITHUB_OWNER ?? 'christochula';
if (!/^[a-zA-Z0-9-]+$/.test(owner)) throw new Error('Invalid GitHub owner');
const environment = config.environment ?? 'homolog';
if (!/^[a-zA-Z0-9_-]+$/.test(environment)) throw new Error('Invalid GitHub environment');
const checks = {
  'oficina-api': ['Quality', 'Integration', 'Sonar', 'Frontend', 'BDD', 'Container'],
  'oficina-billing-service': ['Quality', 'Integration', 'Container', 'Sonar'],
  'oficina-production-service': ['Build tests quality'],
  'oficina-auth-serverless': ['application', 'terraform'],
  'oficina-infra-database': ['Validate', 'Plan'],
  'oficina-infra-kubernetes': ['Validate aws', 'Validate observability', 'Plan aws'],
};
const protection = contexts => ({
  required_status_checks: { strict: true, contexts },
  enforce_admins: true,
  required_pull_request_reviews: { dismiss_stale_reviews: true, required_approving_review_count: 1 },
  restrictions: null,
  required_linear_history: true,
  required_conversation_resolution: true,
  allow_force_pushes: false,
  allow_deletions: false,
});
let token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
if (apply && !token) {
  try { token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { throw new Error('Configure GH_TOKEN with repository Administration write, or authenticate GitHub CLI'); }
}
async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}. No tokens or secret values are printed.`);
  return response.status === 204 ? undefined : response.json();
}
for (const [repo, required] of Object.entries(checks)) {
  const settings = config.repositories?.[repo] ?? {};
  const repositoryVariables = { ...(config.sharedRepositoryVariables ?? config.sharedVariables ?? {}), ...(settings.repositoryVariables ?? settings.variables ?? {}) };
  const environmentVariables = { ...(config.sharedEnvironmentVariables ?? {}), ...(settings.environmentVariables ?? {}) };
  const repositorySecrets = [...new Set([...(config.sharedRepositorySecretsFromEnv ?? []), ...(settings.repositorySecretsFromEnv ?? [])])];
  const environmentSecrets = [...new Set([...(config.sharedEnvironmentSecretsFromEnv ?? config.sharedSecretsFromEnv ?? []), ...(settings.environmentSecretsFromEnv ?? settings.secretsFromEnv ?? [])])];
  const secretNames = [...new Set([...repositorySecrets, ...environmentSecrets])];
  for (const name of [...Object.keys(repositoryVariables), ...Object.keys(environmentVariables), ...secretNames]) if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) throw new Error(`Invalid configuration key: ${name}`);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', repository: `${owner}/${repo}`, branch: 'main', environment, requiredChecks: required, repositoryVariables: Object.keys(repositoryVariables), environmentVariables: Object.keys(environmentVariables), repositorySecretsFromEnvironment: repositorySecrets, environmentSecretsFromEnvironment: environmentSecrets }));
  if (!apply) continue;
  for (const [name, value] of Object.entries({ ...repositoryVariables, ...environmentVariables })) if (/REPLACE|preencher/i.test(String(value))) throw new Error(`Replace placeholder variable ${name} before applying configuration`);
  for (const name of secretNames) if (!process.env[name]) throw new Error(`Missing environment secret ${name}; no changes applied to ${repo}`);
  const path = `/repos/${owner}/${repo}`;
  await api(path); // Verify access before changing this repository.
  await api(path, 'PATCH', { delete_branch_on_merge: true, allow_squash_merge: true, allow_merge_commit: false, allow_rebase_merge: false });
  await api(`${path}/environments/${environment}`, 'PUT', {});
  for (const [variablePath, variables] of [[`${path}/actions/variables`, repositoryVariables], [`${path}/environments/${environment}/variables`, environmentVariables]]) {
    const listed = await api(`${variablePath}?per_page=100`);
    for (const [name, value] of Object.entries(variables)) {
      const exists = listed.variables.some(variable => variable.name === name);
      await api(`${variablePath}${exists ? `/${name}` : ''}`, exists ? 'PATCH' : 'POST', { name, value: String(value) });
    }
  }
  for (const [name, scope] of [...repositorySecrets.map(name => [name, 'repository']), ...environmentSecrets.map(name => [name, 'environment'])]) {
    try { execFileSync('gh', ['secret', 'set', name, '--repo', `${owner}/${repo}`, ...(scope === 'environment' ? ['--env', environment] : [])], { input: process.env[name], env: { ...process.env, GH_TOKEN: token }, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch { throw new Error(`Unable to configure secret ${name} for ${repo}; secret value is hidden`); }
  }
  await api(`${path}/branches/main/protection`, 'PUT', protection(required));
  const verified = await api(`${path}/branches/main/protection`);
  if (!verified.enforce_admins?.enabled || verified.required_pull_request_reviews?.required_approving_review_count < 1 || !required.every(name => verified.required_status_checks?.contexts.includes(name))) throw new Error(`Protection verification failed: ${repo}`);
  console.log(`Verified protected main: ${owner}/${repo}`);
}
