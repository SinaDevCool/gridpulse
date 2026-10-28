# GridPulse Meta hackathon candidate

This candidate builds an evidence-based investigation workflow on the existing synthetic facility planner. Meta interprets questions and prioritises checked findings. Canonical Python calculations remain the source of physical quantities. The product does not command equipment.

## Implemented changes

- Conversational composition accepts checked finding IDs rather than model-authored claims. All executor findings remain visible, including omitted warnings and sub-answers.
- Exact experiments submit without a normal-plan input snapshot. Frozen requests, job IDs, baseline fingerprints, case IDs and modes are checked on acceptance and polling recovery.
- Provider receipts retain individual interpretation, claim-selection and brief-selection attempts, model identities, latency, usage and fallback reason. Contributor and unknown Meta model IDs are rejected for this private-planning configuration.
- The Worker uses trusted country metadata to prevent model calls from listed restricted countries. Region-specific sanctions and individual eligibility remain separate account/legal checks.
- Comparison copy distinguishes fixed-command stress from re-optimisation. Existing public/private admission remains unchanged.
- Brief requests can attach an owned completed experiment. Text and JSON exports retain experiment lineage; changing the attached experiment clears the review acknowledgement. Acknowledgement is not operational approval.
- The evaluation harness checks required meaning even for conversational outputs, records stage attribution, and can run actual Meta requests against a display-only fixture without creating Supabase accounts/jobs.
- Older clients receive the checked response format. The new client negotiates claim-selection receipts with `x-gridpulse-capabilities: verified-claims-v1`.

## Reproduce qualification

Run focused tests and managed checks first, using the commands in the implementation plan. Heavy runs must be sequential and comply with the memory guard. Source-only fixture tests do not prove measured performance or a deployed private runtime.

For a bounded live model evaluation, use an existing server-only Meta credential in the process environment:

```powershell
$env:COPILOT_PROVIDER = 'meta'
$env:COPILOT_MODEL = 'muse-spark-1.3'
$env:COPILOT_QUALIFY_CONVERSATIONAL = 'true'
$env:COPILOT_QUALIFY_OFFLINE_FIXTURE = 'true'
node --import tsx scripts/qualify-copilot-conversation.ts
```

The fixture mode is deliberately labelled `actualHostedMilp:false` and `displayOnlyFixture:true`. It tests actual model use through the local production handler. It does not test the hosted solver, Cloudflare runtime, database admission or measured facility performance. Run the genuine cross-repository engine/API qualification separately. Do not enable hosted mode without the necessary authorisation for its account/job writes.

Reports live under ignored `.codex-tmp/conversation-qualification/` with unique timestamps, including failures, source dirty status, token usage, latency and a dated estimate. Do not publish raw private prompts or credentials. No provider fallback is configured in this evaluation mode. For reproducibility, run the core corpus three times sequentially after fixes settle and retain every report.

## Demo sequence

1. Show the accepted synthetic plan, its import target and workload/battery checks.
2. Ask what it achieved and inspect linked evidence and provider stages.
3. Ask a precise interval question, then a follow-up referring to that interval.
4. In an already qualified private session, propose a changed import limit, review the exact before/after inputs and confirm the separate calculation.
5. Compare a re-optimised alternative with a fixed-plan stress result; show a failed or unavailable outcome honestly.
6. Generate the brief with the attached experiment, acknowledge review and download the evidence JSON.
7. Change the selected plan or experiment and demonstrate that stale answers/review do not carry over.

Do not claim step 4 works on the public service, or record mocked results as a real private deployment. If private admission is unavailable, demonstrate the supported public synthetic alternative and label its different basis.

## Release and submission gates

The implementation plan's optional document extraction, measured calibration and physical control are not silently activated. Actual site data and engineering approval cannot be manufactured by software. No PR #37-only changes, migrations, billing changes or physical commands belong to this candidate.

Record the final Product SHA, Engine SHA, pinned API SHA and qualified artifact hashes before release. Use existing workflows and publish the tested artifact, with the prior artifact available for rollback. Do not change the Engine release when it is unchanged.

The signed-in participant guide has now confirmed that existing startup products may be extended, public repositories are required, and the demo must be three minutes and identify event-only contributions. See `meta-hackathon-rules-checklist.md`. The accepted track and any separately applicable agreement still need checking. Public-source publication requires explicit approval; submission requires a verified portal receipt.
