import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const code = await readFile(new URL('./check-deploy-gates.mjs', import.meta.url), 'utf8');
const run = new (Object.getPrototypeOf(async function () {}).constructor)('process', 'fetch', 'console', code);
const env = { GH_TOKEN: 'fixture-never-used-on-network', GH_REPO: 'owner/repo', TARGET_SHA: 'a'.repeat(40) };
const names = ['Quality', 'Integration', 'Sonar', 'Frontend', 'BDD', 'Container'];
function checks(overrides = {}) { return names.map((name, index) => ({ name, id: index, conclusion: overrides[name] ?? 'success', app: { slug: 'github-actions' } })); }
const reply = values => async () => ({ ok: true, json: async () => ({ check_runs: values }) });
test('deploy gate accepts only complete successful checks for an exact SHA', async () => { await run({ env }, reply(checks()), { log() {} }); });
test('deploy gate rejects absent, failed, spoofed and newer unsuccessful checks', async () => {
  for (const values of [checks().slice(1), checks({ Sonar: 'failure' }), checks().map(check => ({ ...check, app: { slug: 'other' } })), [...checks(), { name: 'Quality', id: 99, conclusion: 'cancelled', app: { slug: 'github-actions' } }]]) await assert.rejects(run({ env }, reply(values), { log() {} }), /Required check/);
});
test('deploy gate fails closed when GitHub cannot be read or SHA/config is invalid', async () => {
  await assert.rejects(run({ env }, async () => ({ ok: false, status: 403 }), { log() {} }), /HTTP 403/);
  await assert.rejects(run({ env: { ...env, TARGET_SHA: 'main' } }, reply(checks()), { log() {} }), /exact TARGET_SHA/);
});
