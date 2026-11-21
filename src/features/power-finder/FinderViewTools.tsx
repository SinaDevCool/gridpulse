import { lazy, Suspense, useState } from "react";
import { publicScreeningLink } from "./finder-view-state";
import type { FinderControllerContract } from "./controller-contract";
const FinderEvidenceSummary = lazy(() =>
  import("./FinderEvidenceSummary").then((m) => ({ default: m.FinderEvidenceSummary })),
);

export function FinderViewTools({ model }: { model: FinderControllerContract }) {
  const [link, setLink] = useState("");
  const [notice, setNotice] = useState("");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const copy = async () => {
    let next: string;
    try {
      next = publicScreeningLink(window.location.origin, model.search, model.project);
    } catch {
      setNotice("Complete a valid screening brief before copying a link.");
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
            public data; camera, custom layer visibility, private IDs, notes and files are not
            included.
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
