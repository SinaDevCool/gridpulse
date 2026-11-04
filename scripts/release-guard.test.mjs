import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReleasePolicy, checkReleaseGuard, validateStagingRun } from './release-guard.mjs';
const valid = { environment: 'production', ref: 'refs/heads/main', freeze: 'false', change: 'CHANGE-123' };
test('only explicitly unfrozen trusted releases can mutate', () => {
  validateReleasePolicy(valid);
  for (const freeze of ['true', '', undefined, 'False']) assert.throws(() => validateReleasePolicy({ ...valid, freeze }));
  assert.throws(() => validateReleasePolicy({ ...valid, ref: 'refs/heads/feature' }));
  assert.throws(() => validateReleasePolicy({ ...valid, change: '' }));
});
test('unreadable live freeze fails closed', async () => {
  await assert.rejects(checkReleaseGuard({ GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: 'test', RELEASE_ENVIRONMENT: 'production' }, async () => ({ ok: false, status: 403 })), /refusing mutation/);
});
test('production rejects failed, unrelated or different staging candidates', () => {
  const run = { repository: { full_name: 'owner/repo' }, path: '.github/workflows/deploy-staging.yml', head_sha: 'a'.repeat(40), head_branch: 'main', event: 'workflow_dispatch', status: 'completed', conclusion: 'success' };
  validateStagingRun(run, 'a'.repeat(40), 'owner/repo');
  for (const change of [{ conclusion: 'failure' }, { head_sha: 'b'.repeat(40) }, { path: 'other.yml' }, { head_branch: 'feature' }, { repository: { full_name: 'attacker/repo' } }]) assert.throws(() => validateStagingRun({ ...run, ...change }, 'a'.repeat(40), 'owner/repo'));
});
