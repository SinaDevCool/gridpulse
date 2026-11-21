import { candidateSearchChips, candidateSearchReset } from "./finder-view-state";
import type { FinderControllerContract } from "./controller-contract";

export function FinderActiveFilters({ model }: { model: FinderControllerContract }) {
  const chips = candidateSearchChips(model.search, model.maxDistanceKm);
  if (!chips.length) return null;
  const clear = (patch: Parameters<typeof model.updateSearch>[0]) => {
    if (patch.distance != null) model.updateProject({ maxDistanceKm: patch.distance });
    model.setSelected(null);
    model.setSelectedOpportunitySnapshot(null);
    void model.updateSearch({ ...patch, candidate: undefined, compare: undefined });
    model.setInteractionNotice(
      "Search filters updated. Candidate selection and comparison were reset.",
    );
  };
  return (
    <div className="finder-active-filters" aria-label="Active candidate search filters">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-label={`Remove ${chip.label}`}
          onClick={() => clear(chip.patch)}
        >
          <span>{chip.label}</span>
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <button
        type="button"
        className="finder-filter-clear"
        onClick={() => clear(candidateSearchReset)}
      >
        Clear search filters
      </button>
    </div>
  );
}
