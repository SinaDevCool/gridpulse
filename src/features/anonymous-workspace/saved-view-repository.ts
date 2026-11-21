import { openDatabase, requestValue, transactionDone, notify, METADATA } from "./workspace-storage";
import { publicFinderQuery } from "../power-finder/finder-view-state";
import { parseSavedFinderViews, type SavedFinderView } from "./saved-finder-views";
export async function listSavedFinderViews(): Promise<SavedFinderView[]> {
  const db = await openDatabase();
  try {
    return parseSavedFinderViews(
      await requestValue(
        db.transaction(METADATA, "readonly").objectStore(METADATA).get("finderViews"),
      ),
    );
  } finally {
    db.close();
  }
}
async function mutateSavedFinderViews(update: (views: SavedFinderView[]) => SavedFinderView[]) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(METADATA, "readwrite");
    const done = transactionDone(tx);
    const store = tx.objectStore(METADATA);
    const views = parseSavedFinderViews(await requestValue(store.get("finderViews")));
    try {
      store.put(update(views), "finderViews");
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
  } finally {
    db.close();
  }
  notify();
}
export async function saveSavedFinderView(view: SavedFinderView, skipExisting = false) {
  view = { ...view, search: publicFinderQuery(view.search), updatedAt: new Date().toISOString() };
  if (parseSavedFinderViews([view]).length !== 1) throw new Error("Invalid saved search.");
  await mutateSavedFinderViews((views) => {
    if (skipExisting && views.some((v) => v.id === view.id)) return views;
    const remaining = views.filter((v) => v.id !== view.id);
    if (remaining.length >= 20)
      throw new Error("A maximum of 20 searches can be saved. Delete one before saving another.");
    return [view, ...remaining];
  });
}
export async function deleteSavedFinderView(id: string) {
  await mutateSavedFinderViews((views) => views.filter((v) => v.id !== id));
}
