import { useEffect, useState } from "react";
import {
  listSavedFinderViews,
  saveSavedFinderView,
  deleteSavedFinderView,
  subscribeAnonymousWorkspace,
} from "../anonymous-workspace/repository";
import type { SavedFinderView } from "../anonymous-workspace/saved-finder-views";
import { publicFinderQuery } from "./finder-view-state";

export function FinderSavedViews({
  createLink,
  release,
}: {
  createLink: () => string;
  release: string | null;
}) {
  const [views, setViews] = useState<SavedFinderView[]>([]);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void listSavedFinderViews()
        .then((value) => {
          if (active) setViews(value);
        })
        .catch(() => {
          if (active) setNotice("Saved searches are unavailable. Browser storage may be blocked.");
        });
    };
    refresh();
    const unsubscribe = subscribeAnonymousWorkspace(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const save = async () => {
    setBusy(true);
    setNotice("");
    try {
      const title = name.trim();
      if (!title) throw new Error("Enter a search name.");
      const url = new URL(createLink());
      await saveSavedFinderView({
        version: 1,
        id: crypto.randomUUID(),
        name: title,
        search: publicFinderQuery(url.search),
        createdAt: new Date().toISOString(),
        release,
      });
      setName("");
      setNotice("Search saved on this device. It will rerun current public data.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Search could not be saved. Check browser storage.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    try {
      await deleteSavedFinderView(id);
      setNotice("Saved search deleted.");
    } catch {
      setNotice("The search could not be deleted. Browser storage may be unavailable.");
    }
  };
  return (
    <div className="finder-saved-views">
      <p>
        Up to 20 searches on this device. Workspace backup includes these configurations, not
        historical result snapshots.
      </p>
      <label>
        Search name
        <input
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </label>
      <button type="button" disabled={busy || !name.trim()} onClick={() => void save()}>
        {busy ? "Saving search…" : "Save current search"}
      </button>
      {notice && <p role="status">{notice}</p>}
      <ul>
        {views.map((view) => {
          let query: string;
          try {
            query = publicFinderQuery(view.search);
          } catch {
            return (
              <li key={view.id}>
                {view.name}: invalid configuration{" "}
                <button type="button" onClick={() => void remove(view.id)}>
                  Delete invalid search
                </button>
              </li>
            );
          }
          return (
            <li key={view.id}>
              <a href={`/power-finder?${query}`}>{view.name}</a>{" "}
              <button
                type="button"
                aria-label={`Delete saved search ${view.name}`}
                onClick={() => void remove(view.id)}
              >
                Delete
              </button>
              <small>
                {view.release && release && view.release !== release
                  ? "Public release has changed; results will be recalculated."
                  : "Reopens current public data; private site records are excluded."}
              </small>
            </li>
          );
        })}
      </ul>
      {!views.length && <p>No saved searches on this device.</p>}
    </div>
  );
}
