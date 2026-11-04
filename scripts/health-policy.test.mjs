import test from 'node:test';
import assert from 'node:assert/strict';
import { registryTileMinimum } from './health-policy.mjs';
test('production always requires populated registry tiles', () => {
  assert.equal(registryTileMinimum('https://gridpulseinsights.com'), 100);
  assert.throws(() => registryTileMinimum('https://gridpulseinsights.com', 'staging-schema-only'));
  assert.throws(() => registryTileMinimum('https://staging.gridpulseinsights.com.evil.test', 'staging-schema-only'));
});
test('schema-only staging explicitly allows an empty registry without disabling status or content-type checks', () => {
  assert.equal(registryTileMinimum('https://staging.gridpulseinsights.com', 'staging-schema-only'), 0);
  assert.throws(() => registryTileMinimum('https://staging.gridpulseinsights.com', 'skip'));
});
