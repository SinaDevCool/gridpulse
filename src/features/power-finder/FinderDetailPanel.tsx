import { productCapabilities } from "@/config/product-mode";
import { capacityMetricLabels } from "@/features/power-finder/calculated-capacity";
import {
  addComparisonCandidate,
  removeComparisonCandidate,
  serializeComparison,
} from "@/features/power-finder/candidate-comparison";
import { featureSummary } from "@/features/power-finder/fixture-data";
import { formatOperatorNames } from "@/features/power-finder/operator-normalization";
import { savePowerFinderCandidate } from "@/features/power-finder/shortlist";
import { Link } from "@tanstack/react-router";
import { BookmarkPlus, GitCompareArrows, MapPin, Network, ShieldCheck, Zap } from "lucide-react";
import { Suspense } from "react";
import type { FinderControllerContract } from "./controller-contract";
import { FinderOperatorEvidence } from "./FinderOperatorEvidence";
import { FinderSecurityStudy } from "./FinderSecurityStudy";
import { distanceFormatter, kindLabels } from "./page-formatting";
import { PowerFinderCandidateDetail } from "./page-support";
export function FinderDetailPanel({ model }: { model: FinderControllerContract }) {
  const {
    navigate,
    search,
    project,
    selected,
    dataMode,
    requiredImportMw,
    saveStatus,
    setSaveStatus,
    shortlistId,
    setShortlistId,
    propertySaveStatus,
    activeProperty,
    detailPanelRef,
    operatorEvidence,
    operatorEvidenceState,
    c1Study,
    updateSearch,
    persistScreening,
    setInteractionNotice,
    setComparisonOpen,
    operatorCatalog,
    operatorCatalogState,
    capacityMetric,
    selectedOpportunity,
    selectedDetailFeature,
    closeDetail,
    selectedCapacity,
    selectedCapacityOpportunity,
    selectedNodePathways,
    comparisonIds,
    comparedCandidates,
    coordinates,
  } = model;
  return (
    <aside
      ref={detailPanelRef}
      className={`power-finder-detail ${selectedDetailFeature ? "open" : ""}`}
      aria-labelledby={selectedDetailFeature ? "power-finder-detail-title" : undefined}
      tabIndex={selectedDetailFeature ? -1 : undefined}
    >
      {selectedDetailFeature ? (
        ((selected) => (
          <>
            <button
              type="button"
              className="detail-close"
              onClick={() => void closeDetail()}
              aria-label="Close detail"
            >
              ×
            </button>
            <div className="detail-sticky-header">
              <p className="context-label">
                {selectedOpportunity && selected.properties.kind === "node"
                  ? "Selected candidate connection point"
                  : kindLabels[selected.properties.kind]}
              </p>
              <h2 id="power-finder-detail-title">{selected.properties.name}</h2>
              <p>{featureSummary(selected)}</p>
              {selectedOpportunity && (
                <p className="candidate-boundary">
                  {selectedOpportunity.siteName} → {selectedOpportunity.nodeName} ·{" "}
                  {distanceFormatter.format(selectedOpportunity.distanceKm)} km straight-line
                  distance
                </p>
              )}
              {selected.properties.kind === "node" && selectedCapacity && (
                <span className="candidate-truth-status">
                  {selectedCapacityOpportunity.valueMw == null
                    ? `${capacityMetricLabels[capacityMetric]} · ${selectedCapacityOpportunity.fit === "stale" ? "recalculation required" : "not calculated"}`
                    : `${capacityMetricLabels[capacityMetric]} · ${selectedCapacityOpportunity.valueMw} MW · ${selectedCapacity.validationState.replaceAll("_", " ")}`}
                </span>
              )}
            </div>
            {selectedOpportunity && selectedNodePathways.length > 1 && (
              <p className="node-pathway-notice" role="status">
                {selectedNodePathways.length} candidate matches use this node. The highest-ranked
                match is selected from the current list.
              </p>
            )}
            {selectedCapacity &&
              selectedCapacityOpportunity.fit !== "stale" &&
              selectedCapacity.validationState !== "failed" && (
                <section
                  className="finder-panel-card finder-panel-card--study"
                  aria-label="Calculated capacity result"
                >
                  <header>
                    <span>Calculated capacity</span>
                    <b>{selectedCapacity.validationState.replaceAll("_", " ")}</b>
                  </header>
                  <p>
                    Node-specific electrical result for model {selectedCapacity.modelVersion},{" "}
                    {selectedCapacity.scenarioLabel},{" "}
                    {selectedCapacity.securityCase.replace("_", "-").toUpperCase()}.
                  </p>
                  <dl>
                    <div>
                      <dt>Firm import</dt>
                      <dd>{selectedCapacity.firmCapacityMw ?? "—"} MW</dd>
                    </div>
                    <div>
                      <dt>Flexible import</dt>
                      <dd>{selectedCapacity.flexibleCapacityMw ?? "—"} MW</dd>
                    </div>
                    <div>
                      <dt>BESS-assisted</dt>
                      <dd>{selectedCapacity.bessAssistedCapacityMw ?? "—"} MW</dd>
                    </div>
                    <div>
                      <dt>Staged initial / eventual</dt>
                      <dd>
                        {selectedCapacity.stagedInitialCapacityMw ?? "—"} /{" "}
                        {selectedCapacity.eventualCapacityMw ?? "—"} MW
                      </dd>
                    </div>
                    <div>
                      <dt>Restricted hours</dt>
                      <dd>{selectedCapacity.restrictedHours ?? "—"} h/year</dd>
                    </div>
                    <div>
                      <dt>Binding constraint</dt>
                      <dd>
                        {selectedCapacity.bindingCategory?.replaceAll("_", " ") ?? "Not recorded"}
                      </dd>
                    </div>
                  </dl>
                  <small>
                    Calculated {new Date(selectedCapacity.calculatedAt).toLocaleString()} · not a
                    connection offer or capacity reservation.
                  </small>
                </section>
              )}
            {selected.properties.kind === "node" && !selectedOpportunity ? (
              <>
                <section className="candidate-fact-section" aria-labelledby="candidate-known-title">
                  <h3 id="candidate-known-title">Connection Context</h3>
                  <dl>
                    <div>
                      <dt>Mapped Asset</dt>
                      <dd>{selected.properties.name}</dd>
                    </div>
                    <div>
                      <dt>Mapped Voltage</dt>
                      <dd>
                        {selected.properties.voltage_kv?.length
                          ? `${Math.max(...selected.properties.voltage_kv)} kV`
                          : "Unknown"}
                      </dd>
                    </div>
                    <div>
                      <dt>Mapped Network Operator</dt>
                      <dd>
                        {selected.properties.operator
                          ? `${formatOperatorNames(selected.properties.operator)} · responsibility requires confirmation`
                          : "Confirmation required"}
                      </dd>
                    </div>
                    <div>
                      <dt>Infrastructure Source</dt>
                      <dd>
                        {selected.properties.evidence_class === "open_mapping"
                          ? "OpenStreetMap-derived mapping"
                          : selected.properties.evidence_class.replaceAll("_", " ")}
                      </dd>
                    </div>
                  </dl>
                </section>
                {selected.properties.planning_status &&
                  selected.properties.planning_status !== "screening_only" && (
                    <section className="candidate-fact-section">
                      <h3>Published Development Context</h3>
                      <p>{selected.properties.planning_status.replaceAll("_", " ")}</p>
                    </section>
                  )}
              </>
            ) : selected.properties.kind === "industrial_site" ? (
              <dl>
                <div>
                  <dt>Evidence Source</dt>
                  <dd>{selected.properties.evidence_class.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Site Type</dt>
                  <dd>
                    {selected.properties.site_kind?.replaceAll("_", " ") ?? "Industrial land"}
                  </dd>
                </div>
                <div>
                  <dt>Published Area</dt>
                  <dd>
                    {selected.properties.area_ha != null
                      ? `${selected.properties.area_ha.toFixed(1)} ha`
                      : "Not published"}
                  </dd>
                </div>
                <div>
                  <dt>Planning Status</dt>
                  <dd>
                    {selected.properties.planning_status?.replaceAll("_", " ") ??
                      "Screening context only"}
                  </dd>
                </div>
              </dl>
            ) : selected.properties.kind === "line" ? (
              <dl>
                <div>
                  <dt>Mapped Voltage</dt>
                  <dd>
                    {selected.properties.voltage_kv?.length
                      ? `${selected.properties.voltage_kv.join(" / ")} kV`
                      : "Not mapped"}
                  </dd>
                </div>
                <div>
                  <dt>Operator</dt>
                  <dd>{formatOperatorNames(selected.properties.operator) ?? "Not published"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{selected.properties.status?.replaceAll("_", " ") ?? "Mapped"}</dd>
                </div>
                <div>
                  <dt>Evidence Source</dt>
                  <dd>{selected.properties.evidence_class.replaceAll("_", " ")}</dd>
                </div>
              </dl>
            ) : (
              <dl>
                <div>
                  <dt>Technology</dt>
                  <dd>{selected.properties.technology ?? "Not published"}</dd>
                </div>
                <div>
                  <dt>Registered Power</dt>
                  <dd>
                    {selected.properties.net_capacity_mw != null
                      ? `${selected.properties.net_capacity_mw} MW`
                      : "Not published"}
                  </dd>
                </div>
                {selected.properties.kind === "storage_asset" ? (
                  <div>
                    <dt>Registered Energy</dt>
                    <dd>
                      {selected.properties.storage_energy_mwh != null
                        ? `${selected.properties.storage_energy_mwh} MWh`
                        : "Not published"}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Operator</dt>
                  <dd>{formatOperatorNames(selected.properties.operator) ?? "Not published"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{selected.properties.status?.replaceAll("_", " ") ?? "Registered"}</dd>
                </div>
                <div>
                  <dt>Evidence Source</dt>
                  <dd>{selected.properties.evidence_class.replaceAll("_", " ")}</dd>
                </div>
              </dl>
            )}
            {(selected.properties.kind === "generation_asset" ||
              selected.properties.kind === "storage_asset") && (
              <p className="candidate-boundary">
                Registered asset data provides local market context. It does not establish grid
                headroom or connection availability.
              </p>
            )}
            {selectedOpportunity && (
              <Suspense fallback={<p role="status">Loading candidate details…</p>}>
                <PowerFinderCandidateDetail
                  candidate={selectedOpportunity}
                  feature={selected}
                  operatorCatalog={operatorCatalog}
                  operatorCatalogState={operatorCatalogState}
                  actions={
                    <>
                      <button
                        type="button"
                        className="primary-button candidate-shortlist-action"
                        disabled={
                          propertySaveStatus === "saving" ||
                          activeProperty?.preferredCandidateId === selectedOpportunity.id ||
                          shortlistId === selectedOpportunity.id
                        }
                        onClick={async () => {
                          const candidateSet = Array.from(
                            new Map(
                              [...comparedCandidates, selectedOpportunity].map((item) => [
                                item.id,
                                item,
                              ]),
                            ).values(),
                          );
                          const savedPropertyId = await persistScreening(
                            candidateSet,
                            selectedOpportunity.id,
                          );
                          if (savedPropertyId) {
                            setShortlistId(selectedOpportunity.id);
                            setInteractionNotice(
                              `${selectedOpportunity.nodeName} shortlisted for ${project.name}.`,
                            );
                          }
                        }}
                      >
                        <BookmarkPlus aria-hidden="true" />
                        {activeProperty?.preferredCandidateId === selectedOpportunity.id ||
                        shortlistId === selectedOpportunity.id
                          ? "Preferred candidate saved"
                          : "Shortlist candidate"}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          if (comparisonIds.includes(selectedOpportunity.id)) {
                            const next = removeComparisonCandidate(
                              comparisonIds,
                              selectedOpportunity.id,
                            );
                            setInteractionNotice("Candidate removed from comparison.");
                            void updateSearch({ compare: serializeComparison(next) });
                            return;
                          }
                          const result = addComparisonCandidate(
                            comparisonIds,
                            selectedOpportunity.id,
                          );
                          if (result.limitReached) {
                            setInteractionNotice("You can compare up to 5 candidates.");
                            return;
                          }
                          setInteractionNotice(
                            `Candidate added. ${result.ids.length} of 5 comparison slots used.`,
                          );
                          setComparisonOpen(true);
                          void updateSearch({ compare: serializeComparison(result.ids) });
                        }}
                      >
                        <GitCompareArrows aria-hidden="true" />
                        {comparisonIds.includes(selectedOpportunity.id)
                          ? "Remove from comparison"
                          : "Compare"}
                      </button>
                      {activeProperty && propertySaveStatus === "saved" ? (
                        <Link
                          className="secondary-button candidate-return-action"
                          to="/portfolio/$id"
                          params={{ id: activeProperty.id }}
                          search={{ tab: "overview" }}
                        >
                          Open Site Workspace
                        </Link>
                      ) : null}
                    </>
                  }
                />
              </Suspense>
            )}
            {selected.properties.kind === "node" && c1Study?.c3?.available && (
              <FinderSecurityStudy model={model} />
            )}
            {productCapabilities.workspace && selected.properties.kind === "node" && (
              <details className="candidate-advanced-study">
                <summary>
                  <ShieldCheck aria-hidden="true" />
                  Operator evidence
                </summary>
                <FinderOperatorEvidence model={model} />
              </details>
            )}
            {productCapabilities.workspace && coordinates && !selectedOpportunity && (
              <button
                type="button"
                className="primary-button"
                disabled={saveStatus === "saving"}
                onClick={() => {
                  setSaveStatus("saving");
                  void savePowerFinderCandidate(selected, null, requiredImportMw)
                    .then((id) => {
                      setShortlistId(id);
                      setSaveStatus("saved");
                      return navigate({
                        to: "/assessments/new",
                        search: {
                          shortlistId: id,
                          name: selected.properties.name,
                          projectType: "large_load",
                          importMw: requiredImportMw,
                          latitude: coordinates[1],
                          longitude: coordinates[0],
                          federalState: "Brandenburg",
                          challenge: `Screening candidate ${selected.id}; capacity and operator responsibility require confirmation.`,
                        },
                      });
                    })
                    .catch(() => setSaveStatus("error"));
                }}
              >
                <MapPin />{" "}
                {saveStatus === "saving" ? "Saving map context…" : "Start private assessment"}
              </button>
            )}
            {productCapabilities.workspace &&
              !selectedOpportunity &&
              ["node", "industrial_site"].includes(selected.properties.kind) && (
                <button
                  type="button"
                  className="secondary-button power-finder-save"
                  disabled={saveStatus === "saving" || saveStatus === "saved"}
                  onClick={() => {
                    setSaveStatus("saving");
                    void savePowerFinderCandidate(selected, null, requiredImportMw)
                      .then((id) => {
                        setShortlistId(id);
                        setSaveStatus("saved");
                      })
                      .catch(() => setSaveStatus("error"));
                  }}
                >
                  <BookmarkPlus aria-hidden="true" />
                  {saveStatus === "saving"
                    ? "Saving…"
                    : saveStatus === "saved"
                      ? "Saved to shortlist"
                      : saveStatus === "error"
                        ? "Try saving again"
                        : shortlistId
                          ? "Saved to shortlist"
                          : "Save candidate"}
                </button>
              )}
            {productCapabilities.workspace && !coordinates && (
              <p className="detail-help">
                Select a node to start an assessment. Industrial land remains site context only.
              </p>
            )}
            {productCapabilities.workspace &&
              selectedOpportunity &&
              selected.properties.kind === "node" && (
                <button
                  type="button"
                  className="primary-button power-finder-activation-cta"
                  onClick={() => void updateSearch({ study: "activation", studyTab: "overview" })}
                >
                  <Zap aria-hidden="true" /> Assess activation pathways
                </button>
              )}
          </>
        ))(selectedDetailFeature)
      ) : (
        <div className="power-finder-empty-detail">
          <Network />
          <h2>Select a node or site</h2>
          <p>Inspect its voltage, source boundary, operator context and investigation fit.</p>
        </div>
      )}
    </aside>
  );
}
