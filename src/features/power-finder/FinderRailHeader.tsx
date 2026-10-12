import { defaultFinderProject } from "@/features/power-finder/finder-project";
import { Link } from "@tanstack/react-router";
import { BookmarkPlus,MapPin,MapPinned } from "lucide-react";
import { FinderDiscoveryIntro } from "./FinderDiscoveryIntro";
import { FinderProjectEditor } from "./FinderProjectEditor";
import { formatMw } from './page-formatting';
import type { useFinderController } from "./use-finder-controller";
export function FinderRailHeader({ model }: { model: ReturnType<typeof useFinderController> }) {
  const {
    navigate,
    search,
    project,
    setProject,
    setSelected,
    setSelectedOpportunitySnapshot,
    setEnabled,
    bounds,
    maxDistanceKm,
    propertySaveStatus,
    setPropertySaveStatus,
    activeProperty,
    setActiveProperty,
    propertySaveRequest,
    detailReturnFocusRef,
    setShowAllCandidates,
    updateSearch,
    persistScreening,
    setInteractionNotice,
    setComparisonOpen,
    setShowDataCentres,
    finderWorkflow,
    setFinderWorkflow,
    setMapNavigationTarget,
    rankingState,
    coverage,
    regionCode,
    candidates,
  } = model;
  return (
    <div className={`finder-rail-sticky ${finderWorkflow === "discover" ? "is-discovery" : ""}`}>
      <div className="finder-workflow-switch" aria-label="Power Finder workflow">
        <p>Choose your starting point</p>
        <div role="group" aria-label="Power Finder modes">
          <button
            type="button"
            className={finderWorkflow === "screen" ? "is-active" : ""}
            aria-pressed={finderWorkflow === "screen"}
            onClick={(event) => {
              detailReturnFocusRef.current = event.currentTarget;
              setFinderWorkflow("screen");
              void updateSearch({ workflow: "screen" });
            }}
          >
            <MapPin aria-hidden="true" />
            <span>
              <strong>Screen a site</strong>
              <small>Test a known property</small>
            </span>
          </button>
          <button
            type="button"
            className={finderWorkflow === "discover" ? "is-active" : ""}
            aria-pressed={finderWorkflow === "discover"}
            onClick={() => {
              setFinderWorkflow("discover");
              setEnabled({
                node: true,
                line: true,
                industrial_site: true,
                generation_asset: true,
                storage_asset: true,
              });
              setShowDataCentres(false);
              if (regionCode === "DE") {
                const brandenburg = coverage.find((item) => item.regionCode === "DE-BB");
                void updateSearch({ region: "DE-BB", workflow: "discover" });
                if (brandenburg) {
                  setMapNavigationTarget({
                    requestId: Date.now(),
                    kind: "bounds",
                    bounds: brandenburg.bounds,
                    maxZoom: brandenburg.zoom,
                  });
                }
              } else {
                void updateSearch({ workflow: "discover" });
              }
            }}
          >
            <MapPinned aria-hidden="true" />
            <span>
              <strong>Discover locations</strong>
              <small>Search across a region</small>
            </span>
          </button>
        </div>
      </div>
      {finderWorkflow === "discover" ? (
        <FinderDiscoveryIntro model={model} />
      ) : (
        <div className="finder-project-summary">
          <div>
            <small>{activeProperty ? "Site under review" : "Current screening"}</small>
            <strong>{project.name}</strong>
            <span>
              {formatMw(project.importMw)} import · {project.preferredVoltageKv ?? "Any"} kV ·{" "}
              {project.maxDistanceKm} km
            </span>
          </div>
          <div className="finder-project-actions">
            <FinderProjectEditor model={model} />
            <button
              type="button"
              onClick={() => {
                if (
                  (project.latitude != null || project.name !== defaultFinderProject.name) &&
                  !window.confirm(
                    "Start a new screening? Save the current property first if you want to keep it.",
                  )
                )
                  return;
                propertySaveRequest.current += 1;
                setProject({ ...defaultFinderProject, updatedAt: new Date().toISOString() });
                setActiveProperty(null);
                setSelected(null);
                setSelectedOpportunitySnapshot(null);
                setComparisonOpen(false);
                setPropertySaveStatus("idle");
                setShowAllCandidates(false);
                void navigate({ to: "/power-finder", search: {}, replace: true });
                setInteractionNotice("New screening started.");
              }}
            >
              New site
            </button>
            <button
              type="button"
              className="primary-button"
              aria-label={
                propertySaveStatus === "saving"
                  ? "Saving screening"
                  : propertySaveStatus === "saved"
                    ? "Screening saved"
                    : activeProperty
                      ? "Save screening to site"
                      : "Create pipeline site"
              }
              disabled={
                propertySaveStatus === "saving" ||
                propertySaveStatus === "saved" ||
                rankingState === "loading" ||
                project.latitude == null ||
                project.longitude == null
              }
              onClick={() => void persistScreening(candidates.slice(0, 3))}
            >
              <BookmarkPlus aria-hidden="true" />
              {propertySaveStatus === "saving"
                ? "Saving screening…"
                : rankingState === "loading"
                  ? "Finding candidates…"
                  : propertySaveStatus === "saved"
                    ? "Screening saved"
                    : propertySaveStatus === "error"
                      ? "Try saving again"
                      : activeProperty
                        ? "Save screening to site"
                        : "Save screening"}
            </button>
          </div>
          {activeProperty && propertySaveStatus === "saved" ? (
            <div className="finder-workspace-return-card">
              <div>
                <strong>Pipeline site created</strong>
                <span>Continue from Summary, then review each workspace step.</span>
              </div>
              <Link
                className="finder-return-to-workspace"
                to="/portfolio/$id"
                params={{ id: activeProperty.id }}
                search={{ tab: "overview" }}
              >
                Open Site Workspace
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
