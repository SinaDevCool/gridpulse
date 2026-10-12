import {
  ANONYMOUS_WORKSPACE_SCHEMA_VERSION,
  isAnonymousProperty,
  migrateAnonymousProperty,
  type AnonymousProperty,
  type AnonymousDocumentMetadata,
  type AnonymousWorkspaceSettings,
  defaultWorkspaceSettings,
  type AnonymousWorkspaceBackup,
} from "./schema";

const DB_NAME = "gridpulse-anonymous-workspace";
const DB_VERSION = 2;
const PROPERTIES = "properties";
const VERSIONS = "propertyVersions";
const METADATA = "workspaceMetadata";
const DOCUMENTS = "documents";
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
      if (!db.objectStoreNames.contains(DOCUMENTS)) {
        const store = db.createObjectStore(DOCUMENTS, { keyPath: "id" });
        store.createIndex("propertyId", "propertyId", { unique: false });
      }
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
  conflict: "skip" | "replace" | "merge" = "skip",
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
    const byCadastre = new Map(
      existing
        .filter((item) => item.dataCentreProfile?.cadastralReference)
        .map((item) => [item.dataCentreProfile!.cadastralReference!.toLocaleLowerCase(), item]),
    );
    const transaction = db.transaction([PROPERTIES, VERSIONS], "readwrite");
    for (const input of properties) {
      const property = migrateAnonymousProperty(input);
      const externalMatch = property.externalPropertyId
        ? byExternal.get(property.externalPropertyId.toLocaleLowerCase())
        : undefined;
      const cadastreMatch = property.dataCentreProfile?.cadastralReference
        ? byCadastre.get(property.dataCentreProfile.cadastralReference.toLocaleLowerCase())
        : undefined;
      const coordinateMatch = property.externalPropertyId
        ? undefined
        : existing.find(
            (item) =>
              item.project.latitude != null &&
              item.project.longitude != null &&
              property.project.latitude != null &&
              property.project.longitude != null &&
              Math.abs(item.project.latitude - property.project.latitude) < 0.0001 &&
              Math.abs(item.project.longitude - property.project.longitude) < 0.0001,
          );
      const nameMatch = property.externalPropertyId
        ? undefined
        : existing.find(
            (item) =>
              item.name.trim().toLocaleLowerCase() === property.name.trim().toLocaleLowerCase() &&
              item.municipality?.toLocaleLowerCase() === property.municipality?.toLocaleLowerCase(),
          );
      const match = externalMatch ?? cadastreMatch ?? coordinateMatch ?? nameMatch;
      if (match && conflict === "skip") {
        skipped += 1;
        continue;
      }
      const next = match
        ? conflict === "merge"
          ? migrateAnonymousProperty({
              ...property,
              ...match,
              externalPropertyId: match.externalPropertyId ?? property.externalPropertyId,
              municipality: match.municipality ?? property.municipality,
              siteLabel: match.siteLabel ?? property.siteLabel,
              propertyType: match.propertyType ?? property.propertyType,
              propertyCondition: match.propertyCondition ?? property.propertyCondition,
              requiredItLoadMw: match.requiredItLoadMw ?? property.requiredItLoadMw,
              requiredTotalSiteLoadMw:
                match.requiredTotalSiteLoadMw ?? property.requiredTotalSiteLoadMw,
              developmentPhase: match.developmentPhase ?? property.developmentPhase,
              dataCentreProfile: Object.fromEntries(
                Object.keys(property.dataCentreProfile ?? {}).map((key) => [
                  key,
                  (match.dataCentreProfile as Record<string, unknown> | undefined)?.[key] ??
                    (property.dataCentreProfile as Record<string, unknown> | undefined)?.[key],
                ]),
              ) as AnonymousProperty["dataCentreProfile"],
              id: match.id,
              createdAt: match.createdAt,
              updatedAt: new Date().toISOString(),
            })
          : { ...property, id: match.id, createdAt: match.createdAt }
        : property;
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
    const transaction = db.transaction([PROPERTIES, VERSIONS, DOCUMENTS], "readwrite");
    transaction.objectStore(PROPERTIES).delete(id);
    const versions = (await requestValue(transaction.objectStore(VERSIONS).getAll())) as Array<{
      id: string;
      propertyId: string;
    }>;
    versions
      .filter((item) => item.propertyId === id)
      .forEach((item) => transaction.objectStore(VERSIONS).delete(item.id));
    const documents = (await requestValue(transaction.objectStore(DOCUMENTS).getAll())) as Array<{
      id: string;
      propertyId: string;
    }>;
    documents
      .filter((item) => item.propertyId === id)
      .forEach((item) => transaction.objectStore(DOCUMENTS).delete(item.id));
    await transactionDone(transaction);
  } finally {
    db.close();
  }
  notify();
}

export async function clearAnonymousWorkspace(): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction([PROPERTIES, VERSIONS, METADATA, DOCUMENTS], "readwrite");
    transaction.objectStore(PROPERTIES).clear();
    transaction.objectStore(VERSIONS).clear();
    transaction.objectStore(METADATA).clear();
    transaction.objectStore(DOCUMENTS).clear();
    await transactionDone(transaction);
  } finally {
    db.close();
  }
  notify();
}

export async function exportAnonymousWorkspace(
  includeDocumentFiles = false,
): Promise<AnonymousWorkspaceBackup> {
  const storedDocuments = includeDocumentFiles ? await listStoredDocuments() : [];
  return {
    product: "gridpulse-anonymous-workspace",
    schemaVersion: ANONYMOUS_WORKSPACE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    properties: await listAnonymousProperties(),
    settings: await getWorkspaceSettings(),
    documents: await listAllDocumentMetadata(),
    documentFiles: includeDocumentFiles
      ? await Promise.all(
          storedDocuments.map(async ({ blob, ...metadata }) => ({
            metadata,
            base64: await blobToBase64(blob),
          })),
        )
      : undefined,
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
  ).then(async (result) => {
    if (backup.settings) await saveWorkspaceSettings(backup.settings);
    if (backup.documentFiles?.length) await restoreDocumentFiles(backup.documentFiles);
    return result;
  });
}

type StoredDocument = AnonymousDocumentMetadata & { blob: Blob };

export async function listAnonymousDocuments(
  propertyId: string,
): Promise<AnonymousDocumentMetadata[]> {
  const db = await openDatabase();
  try {
    const values = (await requestValue(
      db
        .transaction(DOCUMENTS, "readonly")
        .objectStore(DOCUMENTS)
        .index("propertyId")
        .getAll(propertyId),
    )) as StoredDocument[];
    return values
      .map(({ blob: _blob, ...metadata }) => metadata)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } finally {
    db.close();
  }
}

async function listAllDocumentMetadata(): Promise<AnonymousDocumentMetadata[]> {
  const db = await openDatabase();
  try {
    const values = (await requestValue(
      db.transaction(DOCUMENTS, "readonly").objectStore(DOCUMENTS).getAll(),
    )) as StoredDocument[];
    return values.map(({ blob: _blob, ...metadata }) => metadata);
  } finally {
    db.close();
  }
}

async function listStoredDocuments(): Promise<StoredDocument[]> {
  const db = await openDatabase();
  try {
    return (await requestValue(
      db.transaction(DOCUMENTS, "readonly").objectStore(DOCUMENTS).getAll(),
    )) as StoredDocument[];
  } finally {
    db.close();
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function restoreDocumentFiles(files: NonNullable<AnonymousWorkspaceBackup["documentFiles"]>) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(DOCUMENTS, "readwrite");
    for (const file of files) {
      const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0));
      tx.objectStore(DOCUMENTS).put({
        ...file.metadata,
        blob: new Blob([bytes], { type: file.metadata.mimeType }),
      });
    }
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function saveAnonymousDocument(
  propertyId: string,
  file: File,
): Promise<AnonymousDocumentMetadata> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Documents must be 20 MB or smaller.");
  const stored: StoredDocument = {
    id: crypto.randomUUID(),
    propertyId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    hash: await sha256(file),
    sourceClassification: "customer_source",
    reviewStatus: "unreviewed",
    createdAt: new Date().toISOString(),
    blob: file,
  };
  const db = await openDatabase();
  try {
    const tx = db.transaction(DOCUMENTS, "readwrite");
    tx.objectStore(DOCUMENTS).put(stored);
    await transactionDone(tx);
  } finally {
    db.close();
  }
  notify();
  const { blob: _blob, ...metadata } = stored;
  return metadata;
}

export async function deleteAnonymousDocument(id: string) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(DOCUMENTS, "readwrite");
    tx.objectStore(DOCUMENTS).delete(id);
    await transactionDone(tx);
  } finally {
    db.close();
  }
  notify();
}

export async function getWorkspaceSettings(): Promise<AnonymousWorkspaceSettings> {
  const db = await openDatabase();
  try {
    const value = await requestValue(
      db.transaction(METADATA, "readonly").objectStore(METADATA).get("settings"),
    );
    return {
      ...defaultWorkspaceSettings,
      ...(value as Partial<AnonymousWorkspaceSettings> | undefined),
    };
  } finally {
    db.close();
  }
}

export async function saveWorkspaceSettings(settings: AnonymousWorkspaceSettings) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(METADATA, "readwrite");
    tx.objectStore(METADATA).put({ ...defaultWorkspaceSettings, ...settings }, "settings");
    await transactionDone(tx);
  } finally {
    db.close();
  }
  notify();
}
