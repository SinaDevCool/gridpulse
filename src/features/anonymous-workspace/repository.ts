import {
  ANONYMOUS_WORKSPACE_SCHEMA_VERSION,
  isAnonymousProperty,
  migrateAnonymousProperty,
  type AnonymousProperty,
  type AnonymousWorkspaceBackup,
} from "./schema";

const DB_NAME = "gridpulse-anonymous-workspace";
const DB_VERSION = 1;
const PROPERTIES = "properties";
const VERSIONS = "propertyVersions";
const METADATA = "workspaceMetadata";
const CHANGE_EVENT = "gridpulse:anonymous-workspace-change";

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("Browser storage is unavailable."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROPERTIES)) {
        const store = db.createObjectStore(PROPERTIES, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("externalPropertyId", "externalPropertyId", { unique: false });
      }
      if (!db.objectStoreNames.contains(VERSIONS))
        db.createObjectStore(VERSIONS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(METADATA)) db.createObjectStore(METADATA);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Browser storage could not be opened."));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("The browser transaction was cancelled."));
  });
}

function notify() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
  try {
    const channel = new BroadcastChannel(CHANGE_EVENT);
    channel.postMessage("changed");
    channel.close();
  } catch {
    /* optional */
  }
}

export function subscribeAnonymousWorkspace(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CHANGE_EVENT, listener);
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANGE_EVENT);
    channel.onmessage = listener;
  } catch {
    channel = null;
  }
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    channel?.close();
  };
}

export async function listAnonymousProperties(): Promise<AnonymousProperty[]> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(PROPERTIES, "readonly");
    const values = await requestValue(transaction.objectStore(PROPERTIES).getAll());
    return (values as AnonymousProperty[])
      .filter(isAnonymousProperty)
      .map(migrateAnonymousProperty)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  } finally {
    db.close();
  }
}

export async function getAnonymousProperty(id: string): Promise<AnonymousProperty | null> {
  const db = await openDatabase();
  try {
    const value = await requestValue(
      db.transaction(PROPERTIES, "readonly").objectStore(PROPERTIES).get(id),
    );
    return isAnonymousProperty(value) ? migrateAnonymousProperty(value) : null;
  } finally {
    db.close();
  }
}

export async function saveAnonymousProperty(property: AnonymousProperty): Promise<void> {
  const migrated = migrateAnonymousProperty(property);
  const db = await openDatabase();
  try {
    const transaction = db.transaction([PROPERTIES, VERSIONS, METADATA], "readwrite");
    transaction.objectStore(PROPERTIES).put(migrated);
    transaction.objectStore(VERSIONS).put({
      id: `${migrated.id}:${migrated.updatedAt}`,
      propertyId: migrated.id,
      snapshot: migrated,
      createdAt: migrated.updatedAt,
    });
    transaction.objectStore(METADATA).put(ANONYMOUS_WORKSPACE_SCHEMA_VERSION, "schemaVersion");
    await transactionDone(transaction);
  } finally {
    db.close();
  }
  notify();
}

export async function importAnonymousProperties(
  properties: AnonymousProperty[],
  conflict: "skip" | "replace" = "skip",
): Promise<{ imported: number; skipped: number }> {
  const db = await openDatabase();
  let imported = 0;
  let skipped = 0;
  try {
    const existing = (
      (await requestValue(
        db.transaction(PROPERTIES, "readonly").objectStore(PROPERTIES).getAll(),
      )) as AnonymousProperty[]
    )
      .filter(isAnonymousProperty)
      .map(migrateAnonymousProperty);
    const byExternal = new Map(
      existing
        .filter((item) => item.externalPropertyId)
        .map((item) => [item.externalPropertyId!.toLocaleLowerCase(), item]),
    );
    const transaction = db.transaction([PROPERTIES, VERSIONS], "readwrite");
    for (const input of properties) {
      const property = migrateAnonymousProperty(input);
      const match = property.externalPropertyId
        ? byExternal.get(property.externalPropertyId.toLocaleLowerCase())
        : undefined;
      if (match && conflict === "skip") {
        skipped += 1;
        continue;
      }
      const next = match ? { ...property, id: match.id, createdAt: match.createdAt } : property;
      transaction.objectStore(PROPERTIES).put(next);
      transaction.objectStore(VERSIONS).put({
        id: `${next.id}:${next.updatedAt}`,
        propertyId: next.id,
        snapshot: next,
        createdAt: next.updatedAt,
      });
      imported += 1;
    }
    await transactionDone(transaction);
  } finally {
    db.close();
  }
  notify();
  return { imported, skipped };
}

export async function deleteAnonymousProperty(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction([PROPERTIES, VERSIONS], "readwrite");
    transaction.objectStore(PROPERTIES).delete(id);
    const versions = (await requestValue(transaction.objectStore(VERSIONS).getAll())) as Array<{
      id: string;
      propertyId: string;
    }>;
    versions
      .filter((item) => item.propertyId === id)
      .forEach((item) => transaction.objectStore(VERSIONS).delete(item.id));
    await transactionDone(transaction);
  } finally {
    db.close();
  }
  notify();
}

export async function clearAnonymousWorkspace(): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction([PROPERTIES, VERSIONS, METADATA], "readwrite");
    transaction.objectStore(PROPERTIES).clear();
    transaction.objectStore(VERSIONS).clear();
    transaction.objectStore(METADATA).clear();
    await transactionDone(transaction);
  } finally {
    db.close();
  }
  notify();
}

export async function exportAnonymousWorkspace(): Promise<AnonymousWorkspaceBackup> {
  return {
    product: "gridpulse-anonymous-workspace",
    schemaVersion: ANONYMOUS_WORKSPACE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    properties: await listAnonymousProperties(),
  };
}

export async function restoreAnonymousWorkspace(
  value: unknown,
  conflict: "skip" | "replace" = "replace",
) {
  if (!value || typeof value !== "object") throw new Error("The workspace backup is invalid.");
  const backup = value as Partial<AnonymousWorkspaceBackup>;
  if (
    backup.product !== "gridpulse-anonymous-workspace" ||
    !Array.isArray(backup.properties) ||
    !backup.properties.every(isAnonymousProperty)
  )
    throw new Error("The file is not a valid GridPulse workspace backup.");
  if ((backup.schemaVersion ?? 1) > ANONYMOUS_WORKSPACE_SCHEMA_VERSION)
    throw new Error(
      "This backup was created by a newer GridPulse workspace. Update GridPulse before restoring it.",
    );
  return importAnonymousProperties(
    backup.properties.map((property) => ({
      ...migrateAnonymousProperty(property),
      source: "workspace_restore",
    })),
    conflict,
  );
}
