# Power Finder: next exploration release and data-dependent roadmap

Prepared 21 November 2026 against production `5eb0b19d1e2e7688290aa7e3882305492313a914`
(PR #99). This is the implementation backlog for the follow-up request. The prior
[interface plan](INFRAMATION-UI-IMPLEMENTATION-PLAN.md) records the released first
increment; do not repeat its chips, table, public-link or coverage-summary work.

## Product goal and scope

Let a user explore admitted infrastructure, narrow the current map population,
understand why a candidate matches, discover regional investigation areas, save a
search and hand off the same filtered evidence. Preserve the existing site and
operator evidence workflow. Germany is the geographic scope; registered generation
MW, storage power, energy, mapped voltage and available import MW remain distinct.

The user authorised planning followed by implementation, qualification, push and
deployment. This does not admit missing third-party data, change Supabase schema,
enable paid services or resume parked PR #37. New authoritative engineering stays
with the canonical analytics service/Fullb, not this browser application.

## Verified baseline and ownership map

| Concern | Existing owner and verified behaviour | Follow-up boundary |
| --- | --- | --- |
| Canonical URL state | `search-contract.ts`; controller contracts already reference `FinderSearch` | Add fields here once; never maintain another search shape |
| Candidate filtering/sorting | `finder-selectors.ts`, `use-finder-candidates.ts`, `page-formatting.ts` | Extend the shared comparator, not a table-local sorter |
| Candidate table | `FinderResultsTable.tsx`, lazy in `FinderStage.tsx` | Extend this table; extract shared dock chrome only if the asset view needs it |
| Selection and details | `select-finder-candidate.ts`, `FinderDetailPanel.tsx`, `useFinderSelectionEffects.ts` | Reuse feature IDs and actual geometry; raw assets are not candidate matches |
| Map lifecycle | `PowerFinderMap.tsx`, `features/map/*` registries, reducer and interactions | One map; no new tile store or independently recreated layer controls |
| Public data transport | `public-power-finder-api.ts`, `neon-finder-public.ts`, existing viewport/tile routes | Current production is Neon; some older ownership notes name historical Supabase RPCs |
| Filtered viewport | `selectVisibleCollection`, `collection.metadata`, map source registry | Bounded retrieved records are not nationwide inventory or rendered-feature counts |
| Regional discovery | `FinderDiscoveryIntro.tsx`, `use-regional-discovery.ts`, `regional-discovery-sampling.ts`, `location-discovery.ts` | Already has Bundesland, demand, preferred voltage, distance, strategy and result count; improve this form, not another wizard |
| Operators | `operator-catalog.ts`, `operator-normalization.ts`, `operator-map-navigation.ts`, controller navigation action | Mapped operator context only; do not convert proximity to ownership/responsibility |
| Source evidence | `source-provenance.ts`, `evidence-receipt.ts`, `FinderEvidenceSummary.tsx`, grid-connection domain | Reuse truth classes; missing source dates never become retrieval dates |
| Site qualification | anonymous workspace schema, eleven qualification dimensions and enrichment findings | Add admitted findings to this workflow, not a competing land suitability score |
| Local persistence | `anonymous-workspace/repository.ts`, IndexedDB metadata, backup/restore and change notifications | Store saved searches here; no second database or auth system |
| Exports | `properties/property-export.ts`, `site-portfolio/workspace-export.ts` | Reuse download/CSV encoding infrastructure; keep candidate and property projections separate |
| Historical generation | `services/grid-data/src/grid_data/historical_utilisation.py` and its tests | Extend the existing offline calculation; no second utilisation formula |
| Releases/tests | managed runner, `scripts/e2e-manifest.mjs`, existing CI and staged release workflows | Sequential local heavy jobs; exact-SHA artifacts and normal reviewer controls |

## Decisions preventing redundant work

1. Keep `/power-finder` as the application entry point. Add an optional
   infrastructure results presentation, not a separate app or second map.
2. Candidate rows represent site-to-node matches; infrastructure rows represent
   retrieved source records. Labels, exports and counters must preserve that
   distinction even if dock chrome is shared.
3. Reuse the current viewport response for the first infrastructure explorer.
   Call it **current map records**. Do not download the national dataset or scrape
   rendered tiles to populate a purported complete catalogue.
4. Existing discovery criteria already cover most of the proposed guided search.
   Add criteria review, URL fidelity and visible limitations rather than duplicate
   controls, algorithms or a new score.
5. Existing map presets remain the layer owner. Table presets change columns,
   not layer participation or ranking. Saved searches are user configurations,
   not frozen evidence archives or server subscriptions.
6. Unknown, zero, unavailable and not applicable are different states. A missing
   generation rating is not zero, and voltage is not an import-capacity claim.
7. Start with current-sample counts. Defer authoritative national facets to a
   separately reviewed bounded backend aggregate contract when demand justifies it.
8. No owner/company graph, project queue or alert delivery is created from UI
   labels alone. These require the source gates below.

## Phase 0 — preserve production and pin contracts

- Branch from current `origin/main`; preserve original workspace edits and PR #38
  corrections. PR #37 stays excluded.
- Confirm the above owners before editing; record source/release assumptions.
- Use the existing native table and map patterns. Keep additions lazy: the Finder
  route and global CSS budgets have limited headroom after PR #99.
- Define candidate sort additions, table column IDs, infrastructure filter state,
  discovery settings and optional saved-map-area state in canonical contracts.
- Keep old URLs and device-local workspace backups readable.

Acceptance: no parallel state/transport owner introduced; malformed optional URL
fields fail safely; no database, account, paid-plan or source-rights mutation.

## Phase 1 — richer candidate table and trustworthy exports

1. Add distance ascending and mapped-operator alphabetical sorting to
   `CandidateSort`, the URL enum, shared selector, card select and table headers.
   Add deterministic ID tie-breaks; missing values sort last.
2. Add optional column visibility with essential candidate identity always
   visible. Provide compact, technical and evidence presets in the existing dock.
   Presets must not silently change candidate ranking or requested demand.
3. Extract shared CSV cell encoding/download behaviour from the existing property
   exporter. Defend spreadsheet formula prefixes, quotes, line breaks and German
   Unicode. Do not import the XLSX writer into the eager Finder route.
4. Add a candidate export projection of the exact ordered filtered matches,
   including candidate/node IDs, voltage, straight-line distance, mapped operator,
   investigation fit and explicitly unverified import capacity. Include release,
   retrieval cap, query/publication distinction, methods and source attribution.
5. Offer CSV for tabular data and a JSON evidence package for structured metadata;
   reuse `downloadJson`. Do not force candidate rows into the property export type.

Acceptance: card/table order agrees; URL survives refresh; header `aria-sort` is
correct; hidden columns do not remove identity; downloaded rows match the filtered
population and preserve its cap/unknowns; formula injection is neutralised.

## Phase 2 — infrastructure explorer within the existing map

1. Add a validated optional infrastructure presentation to existing results state.
   Make the mode accessible from the current results controls even without a site.
2. Lazy-load the explorer inside `FinderStage`. Reuse the dock's close, expand,
   mobile scrolling, selected-detail separation and return-focus behaviour.
3. Project existing `visibleCollection` records with deduplication by canonical
   feature ID. Use real source geometry for selection; geometryless records cannot
   create an invented point. Selecting an asset opens the existing detail panel.
4. Add bounded-list controls for kind, source evidence and missing-field state.
   Retain existing query, voltage/operator context and technology/range controls.
   Filter controls must state whether they affect the infrastructure list or map.
5. Show name, kind, mapped voltage, registered generation/storage power,
   technology, operator and source where available. Label inapplicable fields.
   Keep registered power separate from available import capacity.
6. Limit presentation work to a bounded page of retrieved records, with explicit
   result/sample counts and load/error/cap states. Export the filtered retrieved
   records through the shared export helpers; no automatic national fetch.

Acceptance: works without a declared site; generation/storage/line/node records
retain their identities; actual geometry is selected; zoom-out gaps and retrieval
caps are visible; current-map records never masquerade as a complete catalogue.

## Phase 3 — improve the existing guided discovery

1. Add a readable criteria summary to `FinderDiscoveryIntro`: selected Bundesland,
   declared load, preferred voltage, maximum node distance, strategy, result count
   and current energy filters. Keep the existing form as the sole editor.
2. Put strategy and result count in the shared validated URL state. Initialise the
   existing discovery state from it and update it from the current controls.
3. Explain the sequence in the existing interface: set criteria → run bounded
   regional sampling → review mapped leads → declare a site → qualify evidence.
4. Continue using existing request revision/cancellation and invalidation owners.
   Reopening a saved configuration never silently restores old ranked results.
5. Explain missing spatial evidence beside the workflow. Flood, parcels, protected
   areas and fibre do not get active hard-exclusion switches without coverage.

Acceptance: one form/score/retrieval path; settings round-trip; stale responses
cannot overwrite new criteria; a mapped lead never becomes a confirmed property.

## Phase 4 — connected exploration, sample facets and explanations

1. Add an operator-context action to existing asset/candidate details. Reuse
   canonical normalization, the catalogue's mapped extent and navigation action.
   Narrow the appropriate mapped operator context and reset stale selections.
2. Explain catalogue mapped-feature counts as their actual population; do not call
   them owned assets, queue positions or operator-confirmed service areas.
3. Derive current-response kind/known-field distributions once from canonical
   deduplicated records. Show the population definition, release and retrieval cap.
   Do not derive a country total from MapLibre rendered features.
4. Add explicit missing-voltage/operator/rating filters to infrastructure records;
   rating missingness applies to generation/storage, not grid lines.
5. Explain candidate inclusion using existing `CandidateOpportunity` fit reasons,
   suitability notes and evidence completeness. Avoid recomputing the score.
6. Extend the current source summary with per-record provenance in detail/export,
   using existing source and publication helpers. No new truth-class union.

Acceptance: alias matching is consistent; map/detail filters clear correctly;
unknown/zero/not-applicable remain distinguishable; facets and exports agree with
their labelled sample; no inference of company ownership or available MW.

## Phase 5 — saved configurations and optional map-area links

1. Add versioned saved-view metadata to the existing anonymous workspace repository
   and backup/restore format. Reuse its transaction and change-notification helpers;
   no new database or localStorage repository.
2. A saved view contains a bounded name, stable ID, creation/update timestamp and
   validated public screening configuration. Limit count and payload size. Omit
   private IDs, property notes, documents and persisted result arrays.
3. Provide save, open and delete controls in an expandable lazy panel. Revalidate
   imported/restored entries and display storage/quota errors without losing work.
   Update entries transactionally so tabs do not overwrite unrelated settings.
4. Reuse the public-link allowlist for all configurations. Optionally include the
   current bounded map area and exact layer participation. Restore through the
   existing map navigation/filter owners, not another camera store.
5. Preserve current safe link defaults: only include map area/layers when chosen.
   Describe map-area fitting as aspect-ratio dependent, not exact camera replay.
6. Saved settings rerun current data; show a release-change note where appropriate.
   Keep anonymous workspace exports private unless the user shares them.

Acceptance: save/reload/open/delete and workspace backup round-trip work; older
backups remain readable; private identifiers never enter public links; opening a
configuration clears prior site selection and does not silently mix local briefs;
map-area restoration does not fight normal map navigation.

## Phase 6 — source admission for history, ownership, projects and alerts

These are explicit dependent work packages, not invented-data implementation
tasks. Reuse the existing [German admission plan](GERMANY-FINDER-LEARNINGS-PLAN.md)
and [utilisation contract](HISTORICAL-GENERATION-UTILISATION.md). Before each package,
record actual source availability and rights; do not create empty production tabs
or dead controls solely to label a package implemented.

### 6A. Generation history and utilisation

- Reuse `historical_utilisation.py` and its capacity-hours methodology.
- Admit covered unit-level series, stable unit matches, net AC basis, capacity
  changes, revisions, window, UTC interval durations and missingness rules.
- Retain reproducible raw inputs, hashes, attribution and licensing evidence.
- Validate annual/rolling values and anomalies against an independently checked
  pilot before any UI chart/filter or comparative percentile.
- Then expose versioned generation series in existing asset details, with sample
  coverage and window controls. No import-headroom or runtime estimate from CF.

Acceptance: matched, licensed pilot reproduces results; incomplete/anomalous series
cannot produce a misleading headline. Dependency: qualified source pilot.

### 6B. Company and ownership graph

- First use mapped operator exploration in Phase 4.
- For ownership, admit stable legal-entity IDs, owner/operator distinctions,
  relationship effective dates, shares, provenance and deduplication rules.
- Reuse existing Neo4j/domain integrations only if an actual query need and
  admitted source justify them; do not introduce another graph store by default.
- Add company navigation only after identity/relationship tests and dated source
  review. Subsidiary assets must not be double-counted in group totals.

Acceptance: documented identity resolution and reproducible scoped totals.
Dependency: authoritative reusable entity/ownership evidence.

### 6C. Retirements, project pipelines and spatial evidence

- Admit German project/retirement records with source-specific stages and
  effective dates; distinguish cancellation, proposal, approval and operation.
- Reuse map/source registries and asset detail; do not treat retiring MW as released
  connection capacity or a national queue as available import MW.
- For land constraints, review Länder-specific flood/rain scenarios, protected
  areas, planning, cadastral rights and provider-confirmed fibre separately.
- Add coverage-aware site findings to the existing eleven-dimension qualification
  model. Administrative boundaries are not land ownership or cadastral proof.

Acceptance: each displayed stage/constraint has source, date, rights and coverage;
uncovered areas remain unassessed. Dependency: actual admitted datasets.

### 6D. Change detection and alerts

- Saved searches in Phase 5 are prerequisites, not alert subscriptions.
- Define immutable release-to-release record matching and correction/supersession
  policy; compare source changes independently of retrieval timestamps.
- Start with user-triggered comparison of admitted releases. Email/push delivery
  needs a separate retention, consent, auth and service-cost decision.
- Reuse existing release manifests and evidence identity; no new scheduler or
  message service until inputs, delivery scope and user permission exist.

Acceptance: fixture changes distinguish additions, removals, corrections and
unknown coverage; no claimed scheduled monitoring without an operating service.
Dependency: retained comparable source releases and authorised delivery scope.

## Phase 7 — validation, review and release

1. Run focused unit tests for shared sorting, asset projection, missingness,
   exports, public-link validation and saved-view parsing/repository changes.
2. Add browser cases to the existing Finder ownership batch in
   `scripts/e2e-manifest.mjs`; do not create another workflow/spec registry.
3. Validate desktop and 390px layouts, light/dark, keyboard/focus, empty/loading/
   failed/capped data, storage errors, restore and malformed URLs. Visually inspect
   generated screenshots, not only DOM assertions.
4. Use `verify:local -- checks`, then a managed build/budgets and fast browser
   gate. Run the complete Finder suite once after changes settle. Heavy local
   jobs remain serial with two unit workers/one browser worker and RAM preflight.
5. Keep lazy boundaries and budgets. Do not raise budgets, heap limits or worker
   counts to conceal regressions. CI retains broader product/runtime checks.
6. Push a working branch and PR, wait for checks, merge normally. Qualify exact
   merged SHA on staging; publish its verified production artifact through normal
   freeze/reviewer controls. No history rewrite or PR #37 inclusion.
7. Check actual production map, explorer, filters, exports, saved searches,
   discovery settings, enquiry/receipt and canonical solver/copilot workflow.
8. Retain run IDs, SHA, Worker version, rollback reference and live evidence.
   Close only task-owned disposable browsers/servers. Preserve original edits.

## Dependency order and completion rules

Execution: Phase 0 → 1 → 2 → 3 → 4 → 5 → release-ready Phase 7.
Phase 6 packages stay admission-gated until their listed evidence exists; then
each follows the same qualification/release gate. Backend national facets and
national catalogue pagination are separate bounded API proposals, not implied by
the current-map explorer. No new database schema is needed for Phases 0–5.

Each phase is complete only after its acceptance checks pass. A source gate is
not complete because the UI has an unavailable badge. Record actual implemented,
tested, released and externally dependent states separately.

## References and evidence limits

- [Inframation assets](https://inframation.io/assets): catalogue, typed attributes,
  source links and linked records; rechecked publicly on 21 November 2026.
- [Inframation site finder](https://inframation.io/site-finder): geographic criteria,
  linked map/list, flood-data exclusions and coverage-aware interpretation.
- [Prior interaction audit](INFRAMATION-INTERACTION-AUDIT.md) and
  [released interface plan](INFRAMATION-UI-IMPLEMENTATION-PLAN.md): fresh/prior/public
  page coverage and browser security blockers; no claim of a newly complete
  private/account walkthrough or permission to copy competitor databases.
- [Ownership register](product/product-ownership-register.md),
  [map ownership](product/map-interaction-architecture.md) and
  [persistence boundaries](persistence-boundaries.md): extend their canonical
  owners. Runtime public backend identity is established by deployed Neon code and
  `deployment/neon-finder/targets.json`, not outdated Supabase references.

## Execution record

Planning completed before application edits. Phases 0–5 are implemented using the
owners above. The source-admission review for Phase 6 is complete as a readiness
assessment, not as admission or deployment of those dependent data features:

| Package | Observed prerequisite state | Release treatment |
| --- | --- | --- |
| Generation history | Current public feature contract has registry ratings but no matched interval-generation/capacity-history series; existing offline calculator retained | No live utilisation chart/filter or percentile published |
| Ownership | Current mapped operator strings/catalogue are not dated legal-entity ownership relationships | Mapped operator exploration shipped; ownership graph gated |
| Projects/retirements/spatial exclusions | No newly admitted dated German stage/retirement/parcel/flood/provider package in this release; optional Neon property enrichment remains unavailable | No queue total, retirement-derived capacity or buildable-land assertion |
| Alerts | Saved configurations exist; comparable retained source epochs and an authorised delivery service are not established here | Local save/open/delete and backup shipped; no monitoring/email promise |

Implemented refinements include shared CSV encoding/downloads, deterministic
candidate sorts, column presets/visibility, candidate exports with declared brief
and source boundaries, a lazy paginated infrastructure view, missing-data/sample
completeness filters, connected operator/point-to-screening actions, discovery
criteria review and URL settings, and saved public configurations in the existing
workspace database. Storage helpers were factored from the existing repository
to respect its architecture ratchet; no second database was created. Public
configuration sharing can optionally include map area and grid/registry layer
participation; basemap/theme and the separate data-centre overlay remain device
preferences. Opening an unsited view never silently inherits a prior site.

Local qualification on 21 November 2026:

- Full unit run: 826 passed, two existing skips. Subsequent focused workbench and
  repository checks: 20 passed after the final contract/persistence refinements.
- Managed tooling (44 tests), encoding, typecheck, architecture and lint passed;
  one pre-existing Operations fast-refresh warning remains.
- Production-format application/Worker build and unchanged budgets passed:
  Finder 497976/500000 bytes; product CSS 459221/460000 bytes.
- Fast browser gate: all 12 passed. Full Finder browser run: all 51 passed.
- Final focused runs passed table/exports, saved configuration reopening, mobile
  dark/discovery and the additional unsited-to-declared-site regression (52nd
  Finder case). Screenshots were visually reviewed; mobile dock height, sticky
  tools summary and checkbox layout were refined from that review.
- Full CI and the existing exact-SHA staging/production workflows are the next
  release gate. Their actual run IDs/outcomes and live qualification are retained
  separately with release evidence; local fixture tests do not certify live data.

No Supabase schema/data/billing changes, new source ingestion, paid upgrade,
physical command, additional backend store or parked PR #37 work is included.
