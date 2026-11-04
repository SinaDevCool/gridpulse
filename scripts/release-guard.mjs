import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export function validateReleasePolicy({ environment, ref, freeze, change }) {
  assert.ok(['staging', 'production'].includes(environment), 'Unknown release environment');
  assert.equal(ref, 'refs/heads/main', 'Release workflows must run from trusted main');
  assert.ok(typeof change === 'string' && /^[A-Za-z0-9][A-Za-z0-9 ._/#:-]{2,159}$/.test(change), 'A change reference is required');
  assert.equal(freeze, 'false', 'Release freeze is active or not configured; explicitly set DEPLOYMENT_FREEZE=false');
}

export async function checkReleaseGuard(env = process.env, request = fetch) {
  const { GITHUB_REPOSITORY: repo, GH_TOKEN: token, RELEASE_ENVIRONMENT: environment } = env;
  assert.match(repo ?? '', /^[\w.-]+\/[\w.-]+$/);
  assert.ok(token, 'GitHub token required to read live environment policy');
  const response = await request(`https://api.github.com/repos/${repo}/environments/${environment}/variables/DEPLOYMENT_FREEZE`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(15000),
  });
  assert.ok(response.ok, `Cannot read live freeze policy (${response.status}); refusing mutation`);
  const policy = await response.json();
  validateReleasePolicy({ environment, ref: env.GITHUB_REF, freeze: policy.value, change: env.CHANGE_REFERENCE });
  if (environment === 'production') {
    assert.match(env.STAGING_RUN_ID ?? '', /^\d+$/, 'Successful staging run ID required');
    const runResponse = await request(`https://api.github.com/repos/${repo}/actions/runs/${env.STAGING_RUN_ID}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000),
    });
    assert.ok(runResponse.ok, 'Cannot verify staging run');
    validateStagingRun(await runResponse.json(), env.GITHUB_SHA, repo);
  }
  console.log(`Release policy passed for ${environment}`);
}

export function validateStagingRun(run, sha, repo) {
  assert.equal(run.repository?.full_name, repo, 'Wrong staging repository');
  assert.equal(run.path, '.github/workflows/deploy-staging.yml', 'Wrong staging workflow');
  assert.equal(run.head_sha, sha, 'Staging must qualify this exact application commit');
  assert.equal(run.head_branch, 'main', 'Staging must run from main');
  assert.equal(run.event, 'workflow_dispatch');
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success', 'Staging did not pass');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await checkReleaseGuard();
