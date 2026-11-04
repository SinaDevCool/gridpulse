import assert from 'node:assert/strict';

export function registryTileMinimum(baseUrl, profile) {
  if (!profile || profile === 'production') return 100;
  assert.equal(profile, 'staging-schema-only', 'Unknown health profile');
  assert.equal(new URL(baseUrl).origin, 'https://staging.gridpulseinsights.com', 'Schema-only health is restricted to staging');
  // Staging intentionally has schema and synthetic jobs, without the production registry import.
  return 0;
}
