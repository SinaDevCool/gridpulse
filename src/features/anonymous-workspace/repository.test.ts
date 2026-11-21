import { listSavedFinderViews, saveSavedFinderView, deleteSavedFinderView } from "./repository";
import { indexedDB as fakeIndexedDb } from "fake-indexeddb";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defaultFinderProject } from "../power-finder/finder-project";
import type { AnonymousProperty } from "./schema";
import {
  clearAnonymousWorkspace,
  deleteAnonymousProperty,
  exportAnonymousWorkspace,
  getAnonymousProperty,
  importAnonymousProperties,
  listAnonymousProperties,
  restoreAnonymousWorkspace,
  saveAnonymousProperty,
} from "./repository";

beforeAll(() => {
  Object.defineProperty(globalThis, "indexedDB", { value: fakeIndexedDb, configurable: true });
});
beforeEach(async () => {
  await clearAnonymousWorkspace();
});

function property(
  id = crypto.randomUUID(),
  externalPropertyId: string | null = "EXT-1",
): AnonymousProperty {
  const now = new Date().toISOString();
  return {
    id,
    schemaVersion: 2,
    name: "Berlin property",
    externalPropertyId,
    project: {
      ...defaultFinderProject,
      name: "Berlin property",
      latitude: 52.5,
      longitude: 13.4,
      importMw: 50,
    },
    boundary: null,
    propertyType: "data_centre",
    propertyCondition: null,
    requiredItLoadMw: null,
    requiredTotalSiteLoadMw: 50,
    exportRequirementMw: null,
    developmentPhase: null,
    landControlStatus: "unknown",
    municipality: null,
    siteLabel: null,
    decisionStatus: "unreviewed",
    decisionRationale: null,
    preferredCandidateId: null,
    selectedCandidateIds: [],
    candidateSnapshots: [],
    evidence: null,
    source: "power_finder",
    createdAt: now,
    updatedAt: now,
  };
}

describe("anonymous workspace repository", () => {
  it("creates, lists, reads and deletes a property", async () => {
    const item = property();
    await saveAnonymousProperty(item);
    expect(await listAnonymousProperties()).toHaveLength(1);
    expect((await getAnonymousProperty(item.id))?.name).toBe(item.name);
    await deleteAnonymousProperty(item.id);
    expect(await listAnonymousProperties()).toEqual([]);
  });
  it("skips duplicate external IDs atomically", async () => {
    await saveAnonymousProperty(property());
    const result = await importAnonymousProperties(
      [property(crypto.randomUUID(), "ext-1"), property(crypto.randomUUID(), "EXT-2")],
      "skip",
    );
    expect(result).toEqual({ imported: 1, skipped: 1 });
    expect(await listAnonymousProperties()).toHaveLength(2);
  });
  it("round trips a workspace backup without changing unknown MW values", async () => {
    const item = { ...property(), requiredItLoadMw: null };
    await saveAnonymousProperty(item);
    const backup = await exportAnonymousWorkspace();
    await clearAnonymousWorkspace();
    await restoreAnonymousWorkspace(backup);
    expect((await listAnonymousProperties())[0].requiredItLoadMw).toBeNull();
  });
});

it("keeps concurrent saved searches, exports/restores them, and preserves old backups", async () => {
  const base = {
    version: 1 as const,
    name: "Berlin",
    search: "mw=55&site=none&propertyId=private",
    createdAt: "2026-11-21T12:00:00Z",
    release: "test-release",
  };
  await Promise.all([
    saveSavedFinderView({ ...base, id: "view-a" }),
    saveSavedFinderView({ ...base, id: "view-b" }),
  ]);
  expect(await listSavedFinderViews()).toHaveLength(2);
  expect((await listSavedFinderViews())[0].search).not.toContain("private");
  const backup = await exportAnonymousWorkspace();
  await clearAnonymousWorkspace();
  await restoreAnonymousWorkspace(backup);
  expect(await listSavedFinderViews()).toHaveLength(2);
  await deleteSavedFinderView("view-a");
  expect((await listSavedFinderViews()).map((v) => v.id)).toEqual(["view-b"]);
  await clearAnonymousWorkspace();
  await restoreAnonymousWorkspace({ ...backup, finderViews: undefined });
  expect(await listSavedFinderViews()).toEqual([]);
});
it("refuses saved search overflow without losing the previous searches", async () => {
  const base = {
    version: 1 as const,
    name: "View",
    search: "site=none",
    createdAt: "2026-11-21T12:00:00Z",
    release: null,
  };
  for (let i = 0; i < 20; i++) await saveSavedFinderView({ ...base, id: "view-" + i });
  await expect(saveSavedFinderView({ ...base, id: "overflow" })).rejects.toThrow("maximum of 20");
  expect(await listSavedFinderViews()).toHaveLength(20);
});
