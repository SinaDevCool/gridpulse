# Germany Power Finder: audit-to-implementation plan

21 November 2026. Scope: local product improvements on `codex/finder-evidence-audit`,
based on production main `a24b816d3ce91c60da34c114ed79864b4aa14dd5`. No push,
deployment, database mutation or parked PR #37 work is part of this execution.

## Intended workflow

Declare phased import/export and a location → retrieve relevant mapped infrastructure →
rank investigation leads → inspect evidence and gaps → save locally / compare → prepare a
responsible-operator enquiry → qualify a written response within its validity and scope.
Historical generation is supplementary context, never available import capacity.

## GridPulse audit findings and treatment

This is the audited code behaviour and resulting change, not a claim of a live-production
incident. Operational coverage still depends on the deployed backend and admitted releases.

| Finding | Why it matters | Implemented treatment / evidence |
| --- | --- | --- |
| Customer or specialised substations could receive overly strong investigation priority | Mapped name/operator is not third-party connection access | Classification notes and explicit score ceilings 65/55; Bayernwerk/Bayer regression; no DSO promotion from generic catalogue type |
| Query date could be confused with publication | An old record can look fresh after every request | Actual feature/release date only; missing/future date gets no freshness qualification; source/date provenance retained |
| Partial/fallback retrieval could look like complete regional data | Empty list can be misinterpreted as no grid | Governed coverage reader, fail-closed unknowns, geographic fallback clipping and visible data mode; no hardcoded national acceptance |
| Capped data / early shortlist could omit relevant candidates | Context filters operate on an incomplete subset | Bounded recursive retrieval, deduplication and all-retrieved-node reranking before shortlist; unresolved cap disclosed |
| URL could expose hidden synthetic capacity | Demonstration MW can look like production evidence | Public URL and effect/state gates; synthetic capacity remains unavailable in public Finder |
| Optional C2/C3/benchmark failure could discard successful C1 | A supplementary outage hides useful results | Independent settled requests; no large static benchmark fallback |
| Discovery proximity and land wording could overstate suitability | Nearby assets do not qualify buildable land | Relevant-node choice before distance, bounded component scores, neutral node-origin proximity; no developable-land assertion |
| Source hash not directly portable in the investigation workflow | Reviewer lacks a compact reference to the calculation | Copyable receipt includes candidate/site/node/source IDs, publication state, methods, class, cap and input hash, with retention/rights limits |
| German site evidence could collapse into a grid score | Flood, title, fibre, cooling, heat and planning need their own sources | Existing eleven-dimension qualification reused; unknown remains Not assessed; operator enquiry is a draft, never sent automatically |
| Utilisation could be confused with headroom or runtime | False MW claims or false production-hours claims | Offline qualified energy ratio and public glossary; no generation-derived headroom output |
| Vulnerable production and tooling dependencies | User-facing sanitisation and toolchain exposure | Lockfile migration, contract/error handling fixes, XLSX round-trip; final audit zero known vulnerabilities at validation time |

## Phase 0 — preserve baseline and sequence work (complete)

1. Work from current production main in a dedicated worktree; preserve existing user edits.
2. Exclude PR #37 schema, workspace-reader and Python worker/runtime additions.
3. Use the serial resource-safe runner and bounded workers. Check memory before heavy runs.
4. Complete the initial implementation and validation before starting the queued external UI audit.

Acceptance: isolated branch, original workspace intact, initial validation recorded in
[FINDER-AUDIT-IMPLEMENTATION.md](FINDER-AUDIT-IMPLEMENTATION.md).

## Phase 1 — establish reliable investigation semantics (complete)

1. Classify mapped network/customer/specialised context without claiming engineering status.
2. Preserve score caps through preferred-voltage reranking; version methods.
3. Separate source publication from query time and fail closed on invalid evidence validity.
4. Bind saved candidates to a SHA-256 of the exact retrieved collection.
5. Keep raw-input retention and atomic multi-source release binding as explicit external gates.

Acceptance: classification, date, reranking, saved-evidence and validity regression passes;
no synthetic or mapping-only candidate is operator-confirmed.

## Phase 2 — retrieve and describe actual data (complete locally)

1. Subdivide capped viewports to depth two / at most 21 sequential requests; deduplicate.
2. Keep successful parent data when children fail; disclose unresolved limits.
3. Use existing governed coverage RPC through a read-only API; unavailable means unknown.
4. Clip static fallback by geography and preserve mode. Do not infer complete national data.
5. Use bounded cache lifetimes and hashed client request keys; preserve exact tile coordinates.

Acceptance: bounded-query, fallback and API contract tests. A local pass does not certify the
live dataset, map/list atomicity or a national release; those require the admission gates below.

## Phase 3 — make the German handoff usable (complete)

1. Keep import/export, phasing, target year, redundancy, FCA and bay questions in the enquiry.
2. Reuse existing site qualification dimensions rather than introducing a competing score.
3. Provide readonly draft text and copy action; retain site evidence as unassessed until reviewed.
4. Add an expandable, copyable evidence receipt. Unknown cap/date/hash states remain explicit.
5. Place the receipt in the existing lazily loaded detail workflow; preserve mobile layout and
   Finder bundle budgets.

Acceptance: a candidate opens, site dimensions render, draft and receipt are readable,
input hash travels with the receipt, clipboard failures leave manually selectable text.
No new account, message service, collection of personal data or external submission.

## Phase 4 — qualify historical generation (complete offline; live source admission gated)

1. Accept only a versioned, reuse-qualified source and matched unit/technology/net AC basis.
2. Use UTC elapsed durations and time-varying capacity; reject overlap/duplicates/nonfinite
   input, invalid capacity and storage-as-generation.
3. Keep missing intervals missing; expose coverage and anomalies. Any anomalous interval
   disqualifies the headline even if an annual average looks plausible.
4. Calculate generation / capacity-hours; always leave import headroom unset.
5. Bound input bytes/records and forbid output overwrite in the offline CLI.
6. Explain CF, runtime, efficiency and import capacity publicly. Do not invent a peer percentile.

Acceptance: seven Python cases already passed for the calculation boundaries, including leap
years/capacity changes/missingness/anomalies; no network, DB publication or runtime worker.
Contract and invocation: [HISTORICAL-GENERATION-UTILISATION.md](HISTORICAL-GENERATION-UTILISATION.md).

## Phase 5 — complete the competitor follow-up (complete)

1. Audit public control families, representative record paths and responsive navigation.
2. Read every dataset licence disclosure; inspect public API/coverage and date/status methods.
3. Record both working patterns and unresolved behaviour; identify untested private workflows.
4. Document annual/rolling/current-capacity differences and the high-CF relative example.
5. Transfer evidence receipt and glossary; preserve existing source-reference distinction.

Acceptance: [INFRAMATION-INTERACTION-AUDIT.md](INFRAMATION-INTERACTION-AUDIT.md) includes
coverage ledger, limitations, formula examples, findings, source URLs and German adaptation.

## Phase 6 — source and operator admission (external acceptance gates)

These steps need evidence and permissions that do not exist in the local workspace. They
cannot be completed by assigning invented values or copying public website output.

| Gate | Required work and dependency | Acceptance / safe current behaviour |
| --- | --- | --- |
| Generation pilot | Select a covered SMARD unit; reconcile identity, net/gross AC basis and capacity history; retain raw bytes, hash, source release/revision, attribution and permission | Reviewer reproduces annual and rolling values against source; unresolved basis blocks publication; current UI has no German underused filter |
| Relative-output metric | Define technology, fuel, unit/station, region, age/commissioning cohort, window, completeness, exclusions, sample minimum, ties and versioned threshold; evaluate holdout examples | Reproducible cohort with uncertainty and no capacity implication; do not ship an arbitrary low-for-kind algorithm |
| Network pilot | Agree operator data-use/security basis; review asset match, network model, constraints, bay evidence, written project response and expiry | Prospective operator outcome supports each scoped conclusion; enquiry alone never qualifies it |
| National geodata | Admit actual Länder flood scenarios, cadastral/planning/land control, environmental and water evidence with licences and effective dates | Coverage gaps stay unassessed; no line-buffer buildable-hectare claim |
| Fibre and heat | Obtain carrier route/delivery evidence and site-specific heat/cooling agreements, restrictions and dates | Coverage atlas / nearby network remains context until the relevant provider confirms scope |
| Reproducibility | Immutable authorised input packages; release IDs across map/list/model; correction and supersession policy | Hash plus retrievable admitted package reproduces result; current hash receipt explicitly does not promise this archive |
| Commercial API | Source-by-source commercial reuse/attribution/derived-database review, API contract, rate limits and availability policy | No automatic bulk Inframation import, challenge bypass or blanket redistribution |

Suggested prospective pilot evaluation: record which mapped leads are reviewed, response
dates and responsible operators, false asset/operator matches, evidence completion, explicit
capacity refusals/conditions, and changes before expiry. Publish measured denominators and
uncertainty. Do not advertise success-rate or time-to-power improvements before observed data.

## Phase 7 — validation and release boundary

Initial broad validation is recorded separately: 795 unit passes, two existing skips,
43 Finder browser passes, 12 fast browser passes, seven Python and seven runtime checks,
tooling/typecheck/architecture/build passes and dependency audit zero known vulnerabilities.

Follow-up validation completed through the managed runner:

- `npm run verify:local -- unit src/features/power-finder/evidence-receipt.test.ts`: two passed.
- `npm run verify:local -- checks`: 34 tooling tests, encoding, typecheck and architecture
  passed (575 modules); lint had zero errors and one existing Operations fast-refresh warning.
- `npm run verify:local -- build`: production client/Worker build and asset budgets passed.
  Finder remained 489718 / 500000 bytes; product CSS 452979 / 460000 bytes.
- `npm run verify:local -- finder-ui tests/finder-e2e/finder-mvp.spec.ts:35 tests/finder-e2e/finder-mvp.spec.ts:79`:
  both affected scenarios passed, in separate sequential stages. The candidate receipt
  included its actual input hash and unconfirmed-capacity boundary; methodology rendered
  the reference links and metric distinctions. The same documented dummy browser fixture
  configuration was used; no production backend or source admission is qualified by these tests.
- Repository-configured `git diff --check` passed. Disposable test servers closed after
  their stages. No new source import, remote mutation or public capacity claim was introduced.

The earlier full suites were not needlessly repeated for the small receipt/glossary follow-up;
their separate results are not presented as tests of later edits.

Production deployment, source admissions and the operator pilot are separate decisions.
This local implementation prepares the workflow and enforces the gates; it does not claim
those external activities have occurred.
