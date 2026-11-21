const DB_NAME = "gridpulse-anonymous-workspace";
const DB_VERSION = 2;
export const PROPERTIES = "properties";
export const VERSIONS = "propertyVersions";
export const METADATA = "workspaceMetadata";
export const DOCUMENTS = "documents";
const CHANGE_EVENT = "gridpulse:anonymous-workspace-change";

export function openDatabase(): Promise<IDBDatabase> {
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

export function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("The browser transaction was cancelled."));
  });
}

export function notify() {
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
