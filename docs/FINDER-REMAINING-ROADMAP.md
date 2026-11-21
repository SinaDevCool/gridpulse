# GridPulse Finder remaining work and acceptance plan

Prepared on 21 November 2026 after the public Finder recovery drill and successful
staging qualification. This plan continues the existing
[German Finder plan](GERMANY-FINDER-LEARNINGS-PLAN.md),
[competitor interaction audit](INFRAMATION-INTERACTION-AUDIT.md) and
[historical-generation contract](HISTORICAL-GENERATION-UTILISATION.md).

## Release baseline

PR #98 merged as `5c5b343a3d65a3d3a9468b75bf2342316000196c`.
Staging run `44918492997` passed every gate and deployed Worker version
`f119c5e2-0ace-43e8-a1f2-ae8696435a42`. Live checks verified national coverage,
2440 operators, populated grid and registry tiles, three regional searches,
operator-enquiry drafts and evidence receipts, with zero failed Finder API
requests in the browser check. Outdated release requests returned 409.

The clean production-database recovery restored 654267 admitted features,
matched every geometry/property hash and the operational-status checksum, and
measured 535986176 database bytes. Credentials are separate for each environment;
the application roles cannot write features or activate snapshots. Temporary
local database credentials were removed. Production workflow `44919589899`
completed successfully; its observed outcome is recorded below.

The public snapshot has local and private off-computer copies. Both uploaded
archive parts were downloaded and verified by SHA-256. Recovery metadata is in
the owner-only [GridPulse Backups folder](https://drive.google.com/drive/folders/16xdMQx6ft4ZrZ0HmmlnNPmOPUHyimSiH).
The backup contains admitted public data, not credentials or private workspaces.

## Order and responsibility

| Phase | Work that can be automated                                                     | Evidence or decision required to finish                                               |
| ----- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1     | Collect operational health and cost measurements; investigate failures         | Enough observed traffic to assess reliability and free-tier fit                       |
| 2     | Package fresh admitted data, verify hashes and geometry, qualify a replacement | Current source terms, capacity for the replacement, exact-release staging success     |
| 3     | Add qualified administrative and site context incrementally                    | Source-specific coverage, licence, effective date and interpretation                  |
| 4     | Reproduce historical generation for a small matched pilot                      | Unit identity, net AC capacity history, revisions and permitted reuse                 |
| 5     | Evaluate a relative-output cohort offline                                      | Reproducible cohort specification, completeness and independent review                |
| 6     | Prepare a prospective operator pilot and draft handoffs                        | Operator data agreement, current engineering evidence and actual responses            |
| 7     | Assess private-workspace migration and Supabase retirement                     | Explicit separate scope, user/account/storage inventory and successful recovery tests |

The agent can do implementation, documentation and technical qualification
without asking the user to run SQL, copy credentials or perform routine console
steps while the connected accounts retain access. External permissions and
operator observations must come from the relevant parties. No messages are sent
by this plan. PR #37 requires separate explicit authorisation naming it.

## Phase 1 — operate the free deployment with measured limits

1. Reuse the existing hourly production-health workflow. Record build identity,
   public API status, populated map resources and the actual canonical MILP
   result when that product capability is enabled. Preserve failure evidence.
2. Review the first day's and first week's available runs. Separate upstream
   basemap failures, database wake-up/query timeouts, empty data, application
   defects and traffic/rate-limit failures before choosing a fix.
3. Record database size, compute consumption and public egress for each Neon
   project. The observed PostgreSQL size is about 511 MiB; it is not the complete
   billable-storage or monthly-traffic measurement. Keep the 700 MiB release
   admission gate and fixed 0.25-CU configuration unless measured evidence and
   user authorisation support a change. A Free project is not an uptime SLA or
   unlimited traffic allowance.
4. Measure cold and warm latency for a bounded set of representative views.
   Confirm successful metadata-cache hits and that errors are not cached.
   Investigate expensive queries with the read-only query plan before adding
   broader caches or increasing compute.
5. If scheduled management-usage collection is added, provision a dedicated
   limited credential through the supported account tooling. Do not embed an
   owner database URI or a personal management token in the repository or client.
6. On a failed release, verify that the recorded previous Worker is restored and
   run live checks against it. Worker rollback does not restore external data.
   For data damage, restore the verified package into an isolated target and
   requalify it before activating traffic.

Acceptance: retained live-health evidence, measured quota headroom, documented
failure categories and a reproducible recovery procedure. Do not advertise an
availability or cost guarantee from a single successful smoke test.

## Phase 2 — refresh the admitted public snapshot safely

1. Retain original source bytes, source release/effective dates, licence and
   attribution, transformation version and cryptographic hashes for each source.
   A source-health check is not permission to ingest or publish a new release.
2. Compare new source records against the admitted snapshot: counts by kind and
   state, identity collisions, deletions, status changes, null fields, geometry
   validity, coordinates, operator matching and capacity/voltage unit changes.
   Review material changes before activation.
3. Choose the replacement storage strategy before importing. Two full snapshots
   of the present size do not safely fit the existing 1 GiB project limit.
   Qualify a separate replacement target or a measured incremental strategy;
   never discover the storage requirement halfway through the live import.
4. Generate a new immutable manifest and receipt identity. Keep source admission
   independent of the application release. Update the registered target and
   release identity only when the new package has qualified.
5. Verify every backup file before writes, restore into the declared environment,
   reproduce all counts/row hashes/status checks, build overviews and refresh
   planner statistics. Check the dedicated app role's actual grants and database
   budget. Refuse a mismatched or already active restore target.
6. Run focused contract tests while editing, then the required CI release gates.
   Qualify the exact application commit on staging, including live map/list
   evidence, stale-page handling, candidate receipt and source coverage.
7. Publish the sealed production artifact through the existing live-freeze and
   reviewer controls. Retain the prior Worker identity and verified input package.
   Remove old resources only under explicit target-specific authorisation.

Acceptance: source rights and dates are recorded; the package is retrievable and
reproducible; the app and database agree on ID and manifest; replacement fits the
measured budget; staging and production live checks pass. No silent partial
national release and no automatic paid upgrade.

## Phase 3 — restore useful optional evidence one source at a time

1. Start with administrative location and mapped infrastructure context. Verify
   the current BKG product's licence, coverage and coordinate reference system.
   Admit a dated package and implement a bounded server-side lookup.
2. Reuse the admitted Finder projection for contextual nearby-infrastructure
   queries where its contract supports this. Keep proximity separate from grid
   connection, parcel access and environmental approval.
3. Define each finding's source ID/version, geometry or point basis, observed or
   effective date, retrieval date, attribution, coverage and failure status.
   Preserve `unavailable` and `unassessed` when evidence is absent.
4. Pilot one Land's actual flood and environmental layers before attempting
   nationwide coverage. Preserve scenario, return period, effective date and
   resolution. A mapped intersection is a screening flag requiring site review.
5. Add planning, land-control, fibre, heat and water evidence only after the
   relevant source/provider is admitted. Nearby fibre or a heat network does not
   establish deliverability, contractual access or available capacity.
6. Test boundary coordinates, overlapping geometries, missing coverage,
   expired data, upstream failures and attribution. Compare several known
   locations directly against official source records as a technical review.
   Use the existing detail workflow and lazy loading to preserve bundle budgets.

Acceptance: each published finding is traceable and coverage-aware. Optional
enrichment currently returns unavailable sources and zero invented findings on
Neon; do not remove that boundary before replacement evidence qualifies.

## Phase 4 — qualify a historical generation pilot

1. Select a small covered generator sample from an official reusable source.
   Confirm the current source terms and retain the raw response/export bytes,
   revision, attribution and publication/effective dates.
2. Resolve source-to-registry identities, unit versus station aggregation,
   technology/fuel and net versus gross AC capacity. Reconcile commissioning,
   retirement and capacity changes over the entire observation window.
3. Preserve UTC interval durations, missingness and revisions. Do not fill a
   missing interval with zero. Exclude storage from generation capacity-factor
   calculations and retain anomalous intervals for review.
4. Run the existing offline qualification against time-varying capacity-hours.
   Reproduce both an explicit annual window and a rolling window. Compare to
   source totals; investigate discrepancies and retain the calculation inputs.
5. Require an independent reproducibility check of identity, denominator, units,
   completeness and anomalies before exposing a headline. Keep observations
   distinct from an explanation of outages, market conditions or curtailment.
6. If admitted, show the metric, exact window, completeness, capacity basis,
   revision and limitations alongside its source. Never convert low generation
   into available import MW, transformer utilisation or a connection promise.

Acceptance: another reviewer can reproduce the result from the retained package.
Unknown identity, capacity history or reuse rights blocks publication. The
offline calculation implementation alone does not satisfy source admission.

## Phase 5 — evaluate a relative-output metric before a filter

1. Version the cohort definition: unit/station basis, technology/fuel, geography,
   age, observation window, data completeness and exclusions.
2. Specify sample-size requirements, ties, revisions, missing-capacity treatment
   and the threshold before evaluating outcomes. Do not copy an unexplained
   competitor label or choose a threshold to produce an attractive map.
3. Evaluate holdout examples and sensitivity to cohort/window/capacity changes.
   Retain uncertainty and denominators; review false explanations caused by
   commissioning, outages, curtailment or commercial dispatch.
4. Publish only if the result adds a defensible investigation signal. Use an
   explicit historical-output label; keep capacity and network suitability
   separate. Otherwise retain the offline analysis and omit the filter.

Acceptance: a reproducible cohort and reviewed examples support the label. No
arbitrary German "underused" ranking is currently qualified for publication.

## Phase 6 — obtain prospective operator evidence

1. Assemble a small shortlist with requested import/export, target year, phases,
   redundancy, operating profile, flexibility assumptions and site evidence.
2. Prepare enquiry drafts and an evidence-request checklist. Obtain explicit
   permission before sending messages or sharing a site's private documents.
3. Agree the operator's data-use/security basis and resolve asset/operator/bay
   identities. Obtain the current scoped model, constraints and written response.
4. Have the canonical analytical service perform admitted engineering analysis;
   do not add a competing browser solver. Keep assumptions, exclusions, model
   version, contingency scope and evidence expiry with every result.
5. Track actual response dates, conditions, refusals, false asset matches,
   evidence completion and changes before expiry. Use observed denominators and
   uncertainty when evaluating product benefit.

Acceptance: written project-specific operator evidence supports each scoped
claim. A draft enquiry, mapped substation or generation statistic cannot satisfy
this gate. Do not claim confirmed capacity or faster time-to-power beforehand.

## Phase 7 — assess remaining Supabase dependencies separately

1. Inventory private authentication, memberships, workspace rows, row-level
   policies, uploaded files, server functions, integrations and retention needs.
   The completed public Finder migration is not an account/workspace migration.
2. Design identity mapping, tenant isolation, storage migration and rollback.
   Compare replacement services against actual requirements and current free
   limits. Keep working identity systems until the replacement qualifies.
3. Restore authorised representative private data in isolation, test cross-tenant
   denial and recovery, and reconcile records/files before any cutover.
4. Obtain explicit authorisation before changing Supabase schema, data or billing,
   retiring its project, or resuming PR #37. Generic deployment authorisation
   does not override these repository restrictions.

Acceptance: private-data permissions, recovery and user journeys qualify in a
separate release. Supabase remains retained until then.

## Validation and release discipline for every implementation phase

- Begin development from current production `origin/main`; preserve PR #38's
  released calculation corrections and leave PR #37 parked.
- Run relevant local tests first. Use the managed resource-safe runner, two unit
  workers and one browser worker. Do not overlap heavy jobs or close user apps.
- Use CI for broad product coverage. Publish the exact sealed artifact after
  exact-commit staging qualification, live freeze checks and the existing
  production reviewer gate. Do not rebuild in the publishing job.
- Keep Finder JS under 500000 bytes and the existing style/map budgets unless a
  separately reviewed budget change is justified. Add optional work lazily.
- Retain real live results separately from mocked browser/solver fixtures. Record
  unresolved external dependencies without labelling them completed.

## Release completion

[Production run 44919589899](https://github.com/SinaDevCool/gridpulse/actions/runs/44919589899)
passed every validation and publishing gate. Worker version
`0f2facb6-7f72-42fa-a373-6b97f2e6dd67` serves the exact admitted application
commit at [GridPulse](https://gridpulseinsights.com/power-finder).

Production health, map and further unmocked Finder checks passed: 2440 operators,
populated grid/registry tiles, Berlin/Bremen/Munich candidate searches with cap
disclosure, enquiry drafts and hashed evidence receipts, zero failed Finder API
requests in the browser check, and 409 for outdated release requests. The release
also verified a real facility MILP across three Operations tabs and the existing
Meta-backed grounded copilot. No grid capacity or physical dispatch is implied.

The named reviewer's normal approval was completed through the existing delegated
account; reviewer rules and the live-freeze policy were preserved. No paid plan
upgrade was enabled. Free quotas still apply. Supabase schema, source data and
billing remain unchanged; private workspaces are not migrated. PR #37 is parked.
The seven remaining phases above are a plan with explicit acceptance gates, not
claims of completed source admissions, operator agreements or prospective results.
