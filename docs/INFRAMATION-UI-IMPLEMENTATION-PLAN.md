# Inframation interface findings and GridPulse implementation plan

Review date: 21 November 2026. Scope: improve the German Power Finder's public
investigation workflow using its current code and admitted public dataset.

Further development is tracked in [the exploration roadmap](FINDER-EXPLORATION-ROADMAP.md); the phases in this document describe the first released increment.

## Evidence and coverage

This review extends [the earlier interaction audit](INFRAMATION-INTERACTION-AUDIT.md).
That record contains the previous desktop/mobile, catalogue, record, company,
site-finder, chart, source and commercial-page walkthrough. It is not silently
treated as a fresh test of every control in this pass.

Fresh Windows-browser actions verified the supplied Ontario map, desktop and
compact navigation, utilisation choices and explanation, missing-output filtering,
results-sheet expansion, name sorting, size/date/owner/source/type filter families,
clearing filters, resetting the view, overlay controls and infrastructure-source
explanations. Missing-output results populated separately from the below-40%
filter. Counts changed after asynchronous updates; intermediate counts are not
coverage findings. The root URL and sheet/sort changes were observed directly.

Windows navigation subsequently failed the desktop tool's URL-verification guard.
An independent, disposable Playwright browser reached a Cloudflare verification
page and was closed without attempting to solve or bypass it. The remaining
sections below were checked against accessible public pages and the earlier
interaction record, not newly clicked end to end. Authentication, subscriptions,
submissions, paid services and private workspaces are untested; no forms were sent.

## Surface inventory and transfer decision

| Surface and controls                                 | Function behind the presentation                                     | GridPulse decision and existing owner                                                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Map filter chips, popovers, apply/clear              | Expose active query state and scoped facets                          | Add removable candidate-search chips to `FinderFilters`; keep the current selectors and `updateSearch`                                  |
| Power/load/type/size controls                        | Distinguish record categories and capacity units                     | Reuse `FinderLayersMenu`, shared map filters and technology registry; keep import demand separate from generation ratings               |
| Underused choices and help                           | Historical output comparison with an explicit missing-data case      | Retain existing glossary/offline calculator; do not publish a German utilisation filter without matched qualified inputs                |
| Date/owner/source facets                             | Filter source attributes, not engineering conclusions                | Keep current mapped operator context; additional dates/ownership filters need admitted fields and precise semantics                     |
| Stage counters and chart                             | Summarise the current population and observation window              | Do not fabricate planning/operating totals from unsupported registry status or mix demand and generation MW                             |
| Collapsible result sheet and table headings          | Keep results near the map; change order without losing context       | Add one optional docked table using the existing candidate array, sort and selection path                                               |
| Map/list selection and record links                  | Relate geography, records and evidence                               | Reuse existing highlight, detail, comparison and enquiry workflows; no second map or record store                                       |
| Base map, key and overlay explanations               | Separate rendering controls from source meaning                      | Keep current theme/basemap and legend; add a compact evidence summary from current metadata                                             |
| Quick search and keyboard access                     | Make the existing search discoverable                                | Focus the existing Finder search with `/`; avoid a parallel search backend                                                              |
| Shareable query state                                | Reopen a public screening configuration                              | Add an allowlisted screening link from the validated schema and current brief; omit private identifiers and device-only records         |
| Projects catalogue and status controls               | Browse dated proposals with source-specific stages                   | Future admitted German project sources; do not relabel ranked site-to-node matches as projects in a national queue                      |
| Company group/self views and ownership figures       | Traverse a resolved organisation graph and deduplicate assets        | Reuse mapped operator catalogue now; a company graph is a separate data-admission task                                                  |
| Asset catalogue, trend/chart windows and metric help | Inspect assets and historical observations                           | Existing infrastructure detail is the owner; historical charts need qualified time series and capacity histories                        |
| Connection-point records and queue explanations      | Display source-specific connection requests                          | No inference of available German import MW; written operator evidence remains required                                                  |
| Site-finder criteria, map bands, list and detail     | Spatially screen corridors with explicit coverage/exclusions         | Reuse current regional discovery and eleven-dimensional site review; no buildable-area or flood-clearance calculation from line buffers |
| Prices, windows and market filters                   | Compare defined market observations                                  | Reuse canonical analytical contracts when admitted; no fabricated nodal-price layer or arbitrage revenue estimate                       |
| Opportunities and tenders                            | Track procurement with deadlines and source links                    | Separate future workflow; tender MW does not establish connection availability                                                          |
| Sources, methodology, gaps and reuse                 | Explain lineage, coverage and rights at the point of use             | Extend presentation of existing metadata; retain receipts and current `data-sources` page                                               |
| Alerts, accounts and services                        | Saved subscriptions, private collaboration and commercial fulfilment | Keep current anonymous local workspace; do not add auth, email delivery or paid service promises as UI decoration                       |

Public page references: [map](https://inframation.io/),
[projects](https://inframation.io/proposals),
[companies](https://inframation.io/organizations),
[assets](https://inframation.io/assets),
[site finder](https://inframation.io/site-finder),
[prices](https://inframation.io/prices),
[opportunities](https://inframation.io/opportunities),
[about](https://inframation.io/about),
[services](https://inframation.io/services),
[alerts](https://inframation.io/alerts),
[API](https://inframation.io/docs/api).

## German implementation research

- MaStR publishes registry attributes such as technology, status, net/nameplate
  ratings and updates. Those attributes are not operating output or available
  grid capacity. Continue using the admitted projection rather than another
  registry ingestion path. [Official filtering guidance](https://www.marktstammdatenregister.de/mastrhilfe/files/regHilfen/Anleitung_zur_Datenfilterung.pdf).
- SMARD provides generation time series for covered generating units of at least
  100 MW. A pilot still needs identity matching, units, capacity history and missing
  interval checks. Its current data-use page separately flags ongoing review of
  wholesale-price licensing; do not assume all price redistribution is settled.
  [Downloads](https://www.smard.de/home/downloadcenter/download-marktdaten),
  [current terms](https://www.smard.de/home/datennutzung).
- BKG's VG250 administrative boundaries can support dated geographic context;
  they are not cadastral boundaries or land-control evidence.
  [Official product](https://gdz.bkg.bund.de/index.php/default/wfs-verwaltungsgebiete-1-250-000-stand-01-01-wfs-vg250.html).
- German flood/rain layers require scenario and Land-specific coverage review;
  even neighbouring Länder need not be harmonised.
  [Official Geoportal example](https://www.geoportal.de/theme/weather/rain/starkregengefahrenhinweise-nrw).
- Public broadband coverage differs from carrier routes and actual site delivery.
  Keep the public atlas separate from controlled infrastructure information and
  provider confirmation. [Breitbandatlas](https://bundesnetzagentur.de/GIGA/DE/Breitbandatlas/start.html),
  [Infrastrukturatlas](https://bundesnetzagentur.de/GIGA/DE/Infrastrukturatlas/start.html).

For UI implementation, use native tables with header buttons and `aria-sort`,
not an unnecessary interactive-grid framework.
[W3C guidance](https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/).
Keep validated URL updates in TanStack Router's existing search-state contract.
[Official router guidance](https://tanstack.com/router/latest/docs/how-to/navigate-with-search-params).
Do not derive nationwide record totals from rendered map features: tiled geometry
can be duplicated or split. [MapLibre API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/).

## Reuse map and duplication prevention

| Capability                           | Existing code to extend                                      | New work permitted                                                                        |
| ------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Search validation                    | `search-contract.ts`                                         | Results-view enum; replace copied contract shapes with `FinderSearch` references          |
| Search, filters, ranking and sorting | `FinderFilters`, `finder-selectors`, `useFinderCandidates`   | Present active candidate filters; no second filtering or ranking implementation           |
| Selection and map navigation         | `FinderCandidates`, controller actions, current map          | Extract the existing selection action once for card and table buttons                     |
| Results presentation                 | `FinderCandidates`, `FinderStage`                            | One lazy docked table, selected state, existing sorting, collapse/close controls          |
| Sources and status                   | `map-source-registry`, `collection.metadata`, runtime status | One lazy evidence summary; preserve unknown dates, caps and independent layer status      |
| Brief and public URL                 | `finderSearchSchema`, current `project` and `updateSearch`   | Allowlisted screening-link serializer and clipboard fallback; no new persistence          |
| Saving, reports and handoff          | Local anonymous workspace, existing detail/receipt/enquiry   | Reuse unchanged; public links do not export private evidence or freeze historical results |
| Engineering                          | Existing canonical service and offline generation contract   | No new optimiser, physical model, database, account system or source ingestion            |

## Ordered implementation and acceptance

### Phase 1 — shared state and visible filters

1. Replace hand-maintained duplicate search shapes in controller contracts with
   the canonical validated `FinderSearch` type.
2. Add a validated cards/table presentation parameter. Existing URLs retain cards.
3. Display removable candidate-search filters, with a clear action that preserves
   site coordinates, declared load and layer settings. Reset selection/comparison
   when the candidate population changes.
4. Build public screening links by allowlist from validated filters and the actual
   declared brief; exclude property/workspace IDs, notes, files and private studies.
   Explain that links rerun current public data and do not preserve camera or
   custom layer visibility. Make the link selectable when clipboard access fails.
5. Add `/` as a discoverable focus shortcut only outside editable controls and
   modifier chords. Reuse the existing search input and panel.

Acceptance: unit tests cover invalid presentation state, share-link privacy and
brief fidelity, bounded values and independent filter removal. Existing default
search and device-local workspace behavior remain intact.

### Phase 2 — one candidate table connected to the existing map

1. Extract the current card-selection action for both presentations; never
   fabricate a node location if its evidence is missing.
2. Lazy-load a table in the existing map stage, using the same candidates and sort.
3. Use native headers and the current supported sort modes. Label investigation
   scores and unknown capacity explicitly. Include selected-row state, keyboard
   selection and hover preview through current map state.
4. Support compact/expanded height and return to cards. Keep horizontal scrolling
   inside the table at narrow widths; no page-level overflow or competing map.

Acceptance: changing presentation keeps filters/brief; selecting either row/card
opens the same detail and highlight; sort updates the same URL; mobile close and
keyboard focus work; capped samples never become national counts.

### Phase 3 — compact evidence access and visual polish

1. Place share/evidence actions near the existing screening controls.
2. Lazy-load the source summary from current metadata and independent grid/registry
   runtime states. Do not add network requests or infer both sources are healthy
   because one is ready.
3. Show admitted release, source publication only when qualified as such, received
   record scope, cap disclosure and methodology links. Separate query time from
   source date and generation ratings from import capacity.
4. Use existing themes, typography, focus styles and responsive breakpoints; keep
   overlays clear of selected-candidate detail and the map legend.

Acceptance: light/dark and 390px layouts, empty/error/capped states, source/date
boundaries and accessibility checks pass. Route and CSS budgets remain enforced.

### Phase 4 — qualify, publish and retain evidence

1. Run relevant unit tests, sequential checks, one production build and budgets.
2. Run the managed fast browser gate, then focused/new Finder cases and the
   complete Finder suite once changes settle. Keep two unit workers and one
   browser worker; close only task-owned disposable processes.
3. Push a working branch and PR, preserve PR #37's exclusion, and wait for CI.
4. Merge normally. Qualify the exact main SHA on staging, then publish its sealed
   production artifact using existing freeze/reviewer controls.
5. Check live map, table/card selection, filters, share fallback and evidence;
   retain observed outcomes and update this plan's completion record.

## Deferred data work

The German source admissions and external operator pilot in
[GERMANY-FINDER-LEARNINGS-PLAN.md](GERMANY-FINDER-LEARNINGS-PLAN.md) remain separate
acceptance gates. They are deliberately excluded from this UI release rather than
implemented with guessed data. The selected four implementation phases above can
be completed with existing admitted data and do not require Supabase changes.

## Completion record

Phases 1–3 are implemented on `codex/finder-interface-improvements`:
removable search chips, validated public screening links and keyboard focus;
one optional map-docked candidate table sharing sorting and selection with cards;
and a lazy source/coverage summary using existing metadata. Controller search
contracts now share the canonical schema. Selection no longer invents geometry.
No database migration, additional data store or competing map/search backend was
introduced. Deferred data admissions above remain explicit prerequisites.

Local qualification on 21 November 2026:

- Full unit run: 815 passed, two existing skips; subsequent focused workbench run:
  seven passed, including the added qualified-publication-date case.
- Managed tooling, encoding, typecheck, architecture and lint checks passed;
  lint retains one pre-existing Operations fast-refresh warning.
- Production-format application/Worker build and enforced size budgets passed.
- Managed fast browser gate: 12 passed.
- Complete Finder browser run: 45 passed and one new light-theme assertion failed;
  its missing style override was corrected, the build repeated, and that exact
  mobile/table/evidence case passed. All 46 cases therefore passed across those
  runs. Desktop table/detail separation and mobile row contrast were visually
  checked; regression assertions cover both issues.

Phase 4 continues through CI, exact-SHA staging qualification, production release
and live verification. Release outcomes must be recorded with actual run IDs;
local fixtures do not establish live backend health. Inframation interaction
coverage remains bounded by the blockers described at the start of this document.
