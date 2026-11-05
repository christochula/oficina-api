const required = ['Quality', 'Integration', 'Sonar', 'Frontend', 'BDD', 'Container'];
const { GH_TOKEN, GH_REPO, TARGET_SHA } = process.env;
if (!GH_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(GH_REPO ?? '') || !/^[a-f0-9]{40}$/.test(TARGET_SHA ?? '')) throw new Error('GH_TOKEN, GH_REPO and exact TARGET_SHA required');
const headers = { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
const checks = [];
for (let page = 1; ; page++) {
  const response = await fetch(`https://api.github.com/repos/${GH_REPO}/commits/${TARGET_SHA}/check-runs?per_page=100&page=${page}`, { headers });
  if (!response.ok) throw new Error(`Unable to verify deploy gates: HTTP ${response.status}`);
  const result = await response.json(); checks.push(...result.check_runs); if (result.check_runs.length < 100) break;
}
for (const name of required) {
  const matches = checks.filter(check => check.name === name && check.app?.slug === 'github-actions').sort((a, b) => b.id - a.id);
  if (matches[0]?.conclusion !== 'success') throw new Error(`Required check missing or unsuccessful: ${name}`);
}
console.log(`All ${required.length} required checks passed for ${TARGET_SHA}`);
