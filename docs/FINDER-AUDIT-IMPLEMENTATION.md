# Finder evidence audit implementation

This branch follows the November 2026 read-only audit. Each phase is implemented and
checked before final release validation. No production deployment, database mutation,
paid service, operator-data redistribution or parked PR #37 work is included.

| Phase | Scope                                                     | Acceptance                                                                                                                     |
| ----- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Isolate changes from production main; preserve local work | Clean task worktree; serial resource-safe validation                                                                           |
| 1     | Infrastructure suitability and operator roles             | Private/specialised assets remain visible with explicit limitations; unknown operators never become DSOs by catalogue fallback |
| 2     | Source dates and provenance                               | Query timestamps never receive source-recency credit; public records preserve actual publication evidence                      |
| 3     | Coverage and degraded responses                           | Accepted coverage comes from governed releases; unavailable coverage stays unknown; fallback scope and mode remain visible     |
| 4     | Candidate retrieval                                       | All retrieved nodes reach contextual reranking and filters; capped retrieval is disclosed                                      |
| 5     | Capacity policy and map delivery                          | Finder URLs cannot enable hidden synthetic capacity; cache is bounded; abuse controls distinguish clients                      |
| 6     | Regional discovery                                        | Bounded component scores, relevant-node choice, honest land and sampling evidence                                              |
| 7     | Interface and study delivery                              | Persistent short claim boundary; independent optional studies; compact failure state                                           |
| 8     | German evidence workflow                                  | Reuse-qualified sources, site-specific enquiry checklist, explicit missing land/flood/fibre/heat evidence                      |
| 9     | Historical utilisation and outcome qualification          | Qualified, time-weighted generation calculation kept separate from headroom; operator outcome gate documented                  |
| 10    | Documentation and validation                              | Current product boundaries; focused regression, tooling and build checks; remaining external gates recorded                    |

## Queued follow-up

After this branch implementation and validation are complete: inspect Inframation pages and
non-consequential controls systematically, update the comparison and German product plan,
then implement additional justified changes. Do not submit accounts, messages, purchases
or other consequential external actions as part of the read-only walkthrough.

## External acceptance gates

An operator pilot cannot be completed using invented observations. It requires a signed
data-use basis, reviewed asset matches, operator security criteria, current network
parameters and prospective connection outcomes. Public source catalogues and enquiry
workflows do not satisfy these gates. National land/flood/fibre coverage requires admitted,
versioned geodata and rights review. Until then the UI must show unassessed evidence.

The canonical analytical service remains the owner of optimisation and physical replay.
No browser calculation or historical generation statistic establishes additional import MW,
equipment-control permission or confirmed delivery.

## Validation record

Updated at the end of implementation with commands, outcomes and unresolved dependencies.
## Method changes in this branch

Investigation ranking is version v5; public provenance is version v3. Mapping-derived
customer and specialised classifications are investigation heuristics, not engineering
qualification. Their displayed investigation score ceilings are 65 and 55 respectively;
these are editorial prioritisation rules, not calibrated connection probabilities. Explicit
mapped network roles still require operator confirmation. Other operators remain unclassified.

Candidate searches subdivide capped viewports to a maximum depth of two (21 total bounded
requests), deduplicate results and retain cap disclosure. Contextual reranking and filters
run before the shortlist is displayed. Regional discovery scores energy context on a bounded
0–100 basis and gives infrastructure-centred origins neutral proximity credit; such an area
is never described as assessed developable land.

Tile caches now have five-minute edge validity and bounded error staleness. This reduces
map/list divergence but cannot supply transactional dataset-release binding absent a release
ID in the existing tile RPC. Exact cross-source replay still requires an immutable operator
release package; no claim of atomic map/list consistency is made by this branch.

New saved candidates retain evidence dates, suitability notes, retrieval caps and the exact
retrieved-input hash. Historical input retention and source rights remain external gates.
Optional study failures do not discard a successful C1 response. Public report generation
omits representative commercial/activation figures, and German names retain Latin-1 characters.

## Completed local validation

- Focused Finder/property/workspace regression: 151 tests passed.
- Full TypeScript unit regression after dependency migration: 795 passed, two existing skips.
- Final focused regression after the error-handler, classification and API checks: 29 passed.
- Historical generation qualification: seven Python tests passed, including interval anomalies that an annual average could hide.
- Tooling: 34 tests passed; encoding, TypeScript and architecture passed.
- Lint: zero errors; one pre-existing Operations fast-refresh warning.
- Final production build and asset budgets passed; Finder client bundle 489718 bytes / 500000.
- Managed fast browser suite: 12 passed, zero failures.
- Final managed Finder browser suite after dependency changes: 43 passed, zero failures, including a real XLSX round-trip preserving German characters, map rendering, accessibility, local evidence, reports, responsive layouts and enquiry/URL-policy cases.
- The initial browser attempts exposed missing Chromium and a worktree dependency-link issue. Both were corrected locally; the final run used isolated lockfile-matched dependencies and the standard Vite file-access policy.
- The dependency migration browser checks found and corrected Zod error-message handling. The new export test was corrected to preserve an already-open brief. The final Finder run used the documented CI fixture configuration, VITE_SUPABASE_URL=https://browser-fixture.invalid and VITE_SUPABASE_PUBLISHABLE_KEY=browser-fixture-key, for mocked catalogue requests. These are not production configuration. Unmocked fixture-origin requests generate local Worker warnings and are unavailable; these runs do not qualify a live backend.
- Full dependency audit including development tools: zero known vulnerabilities after remediation; see DEPENDENCY-SECURITY-2026-11.md.
- Seven compiled Worker runtime contract checks passed after the development toolchain update.
- The XLSX browser smoke check passed again through the final updated Vite/Cloudflare development server; disposable servers closed between stages.

## Completion boundary

The authorised local application phases and dependency remediation are complete and validated. No production deployment,
Supabase schema/data/billing mutation, operator-data publication or PR #37 work occurred.
Operator pilot outcomes, immutable multi-source release retention, reviewed national geodata
and source-specific redistribution permissions remain external acceptance gates. They are
not represented as completed integrations. The queued Inframation walkthrough subsequently began after this completion point.
Its public interaction ledger and findings are in [INFRAMATION-INTERACTION-AUDIT.md](INFRAMATION-INTERACTION-AUDIT.md);
the follow-up implementation and external acceptance gates are in [GERMANY-FINDER-LEARNINGS-PLAN.md](GERMANY-FINDER-LEARNINGS-PLAN.md).
