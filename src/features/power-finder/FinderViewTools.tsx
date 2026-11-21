import { lazy, Suspense, useState } from "react";
import { publicScreeningLink } from "./finder-view-state";
import type { FinderControllerContract } from "./controller-contract";
const FinderEvidenceSummary = lazy(() =>
  import("./FinderEvidenceSummary").then((m) => ({ default: m.FinderEvidenceSummary })),
);

const FinderSavedViews = lazy(() =>
  import("./FinderSavedViews").then((m) => ({ default: m.FinderSavedViews })),
);
export function FinderViewTools({ model }: { model: FinderControllerContract }) {
  const [link, setLink] = useState("");
  const [notice, setNotice] = useState("");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [includeMap, setIncludeMap] = useState(false);
  const createLink = () =>
    publicScreeningLink(
      window.location.origin,
      {
        ...model.search,
        generationGroup: model.generationGroup,
        discoveryStrategy: model.discoveryStrategy,
        discoveryCount: model.discoveryResultCount,
        mapArea: includeMap
          ? [model.bounds.west, model.bounds.south, model.bounds.east, model.bounds.north]
              .map((v) => Number(v.toFixed(5)))
              .join(",")
          : undefined,
        layers: includeMap
          ? Object.entries(model.enabled)
              .filter(([, enabled]) => enabled)
              .map(([kind]) => kind)
              .join(",") || "none"
          : undefined,
      },
      model.project,
    );
  const copy = async () => {
    let next: string;
    try {
      next = createLink();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Complete a valid screening brief before copying a link.",
      );
      setLink("");
      return;
    }
    setLink(next);
    try {
      await navigator.clipboard.writeText(next);
      setNotice(
        "Screening link copied. Review its coordinates and power requirement before sharing.",
      );
    } catch {
      setNotice("Clipboard unavailable. Select and copy the screening link below.");
    }
  };
  return (
    <div className="finder-view-tools">
      <div className="finder-view-tools__actions">
        <button type="button" onClick={() => void copy()}>
          Copy screening link
        </button>
        <span className="finder-search-shortcut">
          Search <kbd>/</kbd>
        </span>
      </div>
      <label>
        <input
          type="checkbox"
          checked={includeMap}
          onChange={(e) => setIncludeMap(e.target.checked)}
        />
        Include current map area and active layers
      </label>
      <details onToggle={(e) => setSavedOpen(e.currentTarget.open)}>
        <summary>Saved searches on this device</summary>
        {savedOpen && (
          <Suspense fallback={<p role="status">Loading saved searches…</p>}>
            <FinderSavedViews
              createLink={createLink}
              release={model.collection?.metadata.dataset_release ?? null}
            />
          </Suspense>
        )}
      </details>
      {notice && <p role="status">{notice}</p>}
      {link && (
        <div className="finder-share-link">
          <label htmlFor="finder-public-screening-link">Public screening link</label>
          <textarea
            id="finder-public-screening-link"
            aria-describedby="finder-public-screening-link-description"
            readOnly
            rows={3}
            value={link}
            onFocus={(event) => event.currentTarget.select()}
          />
          <small id="finder-public-screening-link-description">
            Includes declared coordinates, power requirement and public filters. Reruns current
            public data. Map area and layer visibility are included only when selected; fitted area
            can vary with screen size. Private IDs, notes and files are excluded.
          </small>
        </div>
      )}
      <details
        className="finder-evidence-summary"
        onToggle={(event) => setEvidenceOpen(event.currentTarget.open)}
      >
        <summary>Sources &amp; coverage</summary>
        {evidenceOpen && (
          <Suspense fallback={<p role="status">Loading evidence summary…</p>}>
            <FinderEvidenceSummary model={model} />
          </Suspense>
        )}
      </details>
    </div>
  );
}
