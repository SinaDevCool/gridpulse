# Frontend review and implementation plan

28 October 2026. Scope: the pending domain-evidence candidate (Product PR #88), including conversation, brief, report references, private analysis and offline review. Preserve the current dashboard, solver semantics, owner boundaries and activation flags. Continue the existing review branch; no new branch or production release is needed for this follow-up.

## Analysis

- `src/features/operations/copilot/PlanConversation.tsx`: per-finding fact counts/internal report IDs and the visible AI-stage list compete with the actual answer. Report text is repeated inside source details. Keep every checked finding and warning visible; move implementation metadata into the existing technical receipt.
- `src/features/operations/copilot/PlanCopilot.tsx`: report references duplicate conversation presentation, with inconsistent source-link wording and applicability disclosure. Reuse one accessible report-reference component.
- `src/features/operations/copilot/PrivateAnalysisReview.tsx`: baseline/result fingerprints and solve settings precede decision inputs; controls lack names, decimal steps and shared help. Busy/recovery states are not clear enough. Present a deliberate expandable analysis tool, meaningful method descriptions, input review and visible status; keep request/recovery semantics unchanged.
- `src/features/operations/configuration/OfflineEvidenceReview.tsx`: raw Zod errors are unsuitable user messages, file reading has no busy announcement, and clearing leaves the input value selected. Show an actionable error, announce file processing and results, reset the file control and keep hashes under capture details.
- `src/features/operations/styles/16-canonical-results.css`: mobile composer occupies excessive height (confirmed in existing mobile capture); new panels lack consistent bounded content styles. Keep the provider disclosure visible, shorten help and place longer session/keyboard details behind an explicit disclosure. Bound overflow and retain focus visibility.

## Implementation sequence

1. Add a shared report reference presentation with descriptive publisher links, physical PDF pages, applicability, required inputs and excluded uses; collapse integrity/revision metadata. Use it in conversation and brief. Do not edit report content or retrieval.
2. Simplify checked-finding presentation without dropping any mandatory text or evidence. Keep legacy responses supported. Relocate AI-stage metadata to the technical receipt; retain source inspection and navigation. Reduce mobile composer help while keeping AI disclosure visible.
3. Improve private analysis grouping, method guidance, decimal/named controls, confirmation and busy/recovery labels. Keep feature gates, exact frozen requests and owner-scoped job recovery intact. Hide only technical identifiers in details.
4. Improve local offline-report selection, same-file retry, loading/status announcements, friendly invalid-file errors and bounded long identities. Do not add an upload or activation path.
5. Extend the existing canonical browser journey to exercise actual v2 findings/report references and offline review, including malformed input, clear/reload, light/dark accessibility, mobile overflow and review/export. Add bounded presentation coverage for private analysis if a fixture is required; never enable it in production to test it.
6. Run focused units, managed checks, compatibility fast browser gate, isolated MILP build and owned canonical journey sequentially. Inspect resulting screenshots. Keep full cross-product coverage in CI; update the existing PR with measured results.

Review reference: current [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Recommendations follow the accessibility, long-content, forms and state-feedback rules; the product's existing design system remains the visual basis.

## Additional accessibility finding

The v2 renderer named every evidence paragraph as a region with the same label. That creates redundant, potentially indistinguishable landmarks in multi-finding answers. Findings now remain ordinary content groups inside the named answer article; all text is retained. The browser fixture includes multiple checked evidence paragraphs and report guidance, rather than exercising only the legacy renderer.

## Baseline audit locations (95f1792)

- `src/features/operations/copilot/PlanConversation.tsx:52` - stage metadata competes with answer text; moved into receipt.
- `src/features/operations/copilot/PlanConversation.tsx:54` - repeated named finding regions and internal IDs; replaced by ordinary content groups while retaining all text.
- `src/features/operations/copilot/PlanConversation.tsx:106` - oversized mobile helper block; reduced with a bounded disclosure and visible provider notice.
- `src/features/operations/configuration/OfflineEvidenceReview.tsx:22` - heading level skips context; corrected and checked with Axe.
- `src/features/operations/configuration/OfflineEvidenceReview.tsx:45` - raw validation output; replaced with actionable file guidance.
- `src/features/operations/configuration/OfflineEvidenceReview.tsx:73` - clear action leaves file selected; resets and focuses the file control.
- `src/features/operations/copilot/PrivateAnalysisReview.tsx:234` - baseline hash precedes decision controls; moved into baseline details.

## Local implementation outcome

Implemented the sequence above. Focused copilot tests passed (58), including report applicability/exclusions, duplicate-text suppression, private gates and named decimal controls. Knowledge retrieval tests were also checked and remain unchanged. Managed tooling, encoding, typecheck, architecture and lint passed; one existing Fast Refresh warning remains outside this scope. Both isolated fixture builds passed performance budgets. The compatibility fast gate passed all 12 tests.

The compiled MILP browser journey and offline-review journey passed. They cover v2 multi-finding rendering alongside legacy fallback, report PDF-page links and exclusions, light/dark Axe scans, a 390 x 844 composer bound, privacy disclosure, malformed files, same-file clear/reload, long identifiers, owned alternatives and SHA-256 export integrity. Screenshot inspection prompted an additional spacing/status adjustment in offline review. Strict fixture response validation was added so invalid test payloads fail at the contract boundary rather than looking like a frontend rendering failure.

Private analysis presentation is unit/SSR-checked; a live authorised private analysis session remains part of its existing hosted activation gate. No feature gate, backend, numerical contract, model prompt, database or production deployment changed. Prior live Meta qualification applies to the unchanged server operations source; this frontend follow-up does not require new paid model calls. Full cross-product regression is retained in the existing CI workflow.

The repository discovers `.test.ts` files, so the new JSX-named test was initially excluded. It was converted to the existing `createElement`/server-rendering test convention, and the private panel's imports now use the same resolved relative modules. The two new presentation tests then ran explicitly and passed; the complete focused copilot run passed 58 tests in 11 files. No unit-runner configuration or worker limit changed.
