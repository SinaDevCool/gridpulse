import { defaultFinderProject, type FinderProject } from "./finder-project";
import { safeFinderValue } from "./project-validation";

const DB_NAME = "gridpulse-finder";
const STORE_NAME = "projects";
const ACTIVE_KEY = "active";
const CACHE_KEY = "gridpulse-finder-active-project";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function loadFinderProject(): FinderProject {
  if (typeof window !== "undefined") {
    const cached = window.localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const value = JSON.parse(cached) as Partial<FinderProject>;
        return {
          ...defaultFinderProject,
          ...value,
          latitude: safeFinderValue("latitude", value.latitude, null),
          longitude: safeFinderValue("longitude", value.longitude, null),
          importMw: safeFinderValue("importMw", value.importMw, defaultFinderProject.importMw)!,
          exportMw: safeFinderValue("exportMw", value.exportMw, 0)!,
          batteryPowerMw: safeFinderValue("batteryPowerMw", value.batteryPowerMw, 0)!,
          batteryEnergyMwh: safeFinderValue("batteryEnergyMwh", value.batteryEnergyMwh, 0)!,
        };
      } catch {
        window.localStorage.removeItem(CACHE_KEY);
      }
    }
  }
  return defaultFinderProject;
}

export async function saveFinderProject(project: FinderProject): Promise<void> {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(project));
  if (!window.indexedDB) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(project, ACTIVE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}
