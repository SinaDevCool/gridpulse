import assert from "node:assert/strict";
export function previousWorkerState(deployments, environment, worker) {
  assert.ok(
    Array.isArray(deployments) && deployments.length,
    "Existing Worker deployment required",
  );
  const latest = [...deployments]
    .sort((a, b) => String(a.created_on).localeCompare(String(b.created_on)))
    .at(-1);
  assert.ok(
    latest?.versions?.length === 1 && latest.versions[0].percentage === 100,
    "Automatic rollback requires a single fully deployed version",
  );
  const versionId = latest.versions[0].version_id;
  assert.match(versionId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  return {
    environment,
    worker,
    versionId,
    deploymentId: latest.id,
    recordedAt: new Date().toISOString(),
  };
}
