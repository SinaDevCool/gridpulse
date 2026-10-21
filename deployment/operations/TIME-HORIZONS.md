# Time horizons and release boundary

## Implemented in this release

- `planning-time.ts` owns the versioned time exchange contract and elapsed-duration validation. Decision period, calculation coverage, assessment cutoff, forecast issue time, source identity, initial-state reference and terminal policy are separate. A display selection is deliberately absent from the calculation identity.
- The existing scenario engine publishes its actual 96-interval synthetic coverage and an explicit unfinished-work terminal policy. It remains a synthetic demonstration, not a forecast or canonical job schedule.
- Display presets inspect that full result. Legacy `tomorrow` links redirect to `today`; no repeated day or tomorrow forecast is fabricated. Risk inspection anchors to the first safety-target breach and shifts back at the data boundary when four hours are available. Short coverage is disclosed.
- Display energy and exposure use full-timeline elapsed durations; filtering never resets SOC or removes full-horizon recovery obligations.
- The existing canonical preparation adapter requires matching time/interval/cutoff provenance before forwarding a reviewed facility request. This is admission validation, not independent optimizer certification.
- Existing stateless API, fingerprints, response schemas, shared input panel and canonical adapter are reused. No database migration, billing change, new optimizer or worker is added.

## Phase status and remaining gates

| Phase | Status |
| --- | --- |
| 0 ownership/baseline | Source ownership audited; productive main is the release base. Canonical source is separate in GridPulse-Fullb. |
| 1 time contract | Implemented and tested at the productive exchange/preparation boundary. Private-engine contract evolution remains separate. |
| 2 display projection | Implemented; full calculation trajectory preserved. |
| 3 evidence assembly | Existing workspace cutoff/source gates retained; time alignment added. Real forecasting and complete BMS/job-progress snapshots remain prerequisites. |
| 4 canonical joint planning | Not implemented or certified in this release. Do not substitute the browser scenario heuristic. Requires changes, tests and a versioned approved artifact from the canonical engine owner. |
| 5 rolling state handover | Not enabled. The inspected canonical rolling source re-evaluates uncertainty over the supplied common inputs; it is not proof of observed SOC/job-progress handover or frozen-prefix execution. |
| 6 scenario validation | Time/DST/late-risk/partial-coverage and invariant regressions implemented. Physical repeated-event, deadline and terminal-reserve benchmarks require the canonical artifact and representative data. |
| 7 UI connection | Minimal semantic correction implemented. No future planning/control mode is advertised. |
| 8 shadow acceptance | Not performed: requires real facility history and independent measurements. Synthetic tests cannot replace this gate. |

PR #37 remains parked. Generic deployment requests do not authorize its migrations, workspace-reader changes or worker/runtime additions. Any later infrastructure work needs separate explicit authorization. No schema or billing change is necessary for this bounded scenario/time-contract release.

## Acceptance cases

Validate chronological contiguous intervals, cutoff/forecast issue ordering, range containment, explicit final boundaries, 92/96/100-quarter-hour timelines, the repeated German local-clock hour, irregular elapsed durations, empty and partial display coverage, late-day risk, unchanged assessment identity on zoom, unchanged SOC/recovery, legacy URL migration and all three tabs. Forecasting/live controls remain unavailable rather than claiming false readiness.
