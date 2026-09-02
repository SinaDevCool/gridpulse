# Phase 0–12 canonical implementation map

This map is the release audit index. It does not create a second owner: every calculation points
to its canonical implementation in `gridpulse-grid-core` or `gridpulse-capacity-backtest`.

| Phase | Canonical owner and production boundary | Product workflow | Release evidence |
|---|---|---|---|
| 0 — ownership | `GridPulse-Fullb/config/synthetic_component_ownership.yaml`; `config/analytics-deprecation-register.yaml` | Seven-stage product shell; map/table Power Finder | architecture-boundary and navigation tests |
| 1 — capacity handoff | `application/capacity.py` over `StudyPipeline` and `FlexibilityRequirement` | capacity-requirement durable job and saved result | capacity application and API idempotency tests |
| 2 — workload/facility model | `data_center/*`; `application/facility.py` | Planner canonical workbench and Activation project | facility optimizer, replay, API and UI contract tests |
| 3 — bounded optimizer | `data_center/optimizer.py` with canonical replay | facility-plan job; no command transport | optimizer, deterministic fingerprint and non-dispatch tests |
| 4 — uncertainty | `data_center/uncertainty.py`; `application/uncertainty.py` | uncertainty workbench run | seeded scenario/risk-policy tests |
| 5 — replay/economics | `data_center/backtest.py`, `economics.py`; `application/replay.py` | historical replay and economics run | chronology-leakage and accounting tests |
| 6 — market products | `market/*`; `application/market.py` | market qualification and verified-delivery settlement run | eligibility, canonical-input fingerprint and settlement tests |
| 7 — rolling planning | `data_center/rolling_planner.py`; `application/rolling.py` | rolling-plan run with immutable forecast cutoffs | chronology, revision and fallback tests |
| 8 — shadow twin | existing Phase 3 telemetry/command/fail-safe owners; `application/shadow.py` | Operations project | read-only, no-transport and divergence tests |
| 9 — delivery credibility | `data_center/verification.py`, credibility and dependable-capacity owners | shadow verification result | baseline, rebound, recovery, SLA and telemetry-quality tests |
| 10 — enquiry package | `data_center/reporting.py`; `application/evidence.py` | Reports JSON/Markdown/manifest workflow | deterministic artifact-hash tests |
| 11 — external adapters | `adapters/*` immutable read-only capture and strict parsing | Evidence → source catalog; shadow observations | schema-drift, immutable-capture and adapter-safety tests |
| 12 — qualification | `scripts/verify-canonical-analytics.ps1` | release gate only | full unit, encoding, build, Finder E2E, fast/slow analytical suites; deployed security is an explicit external gate |

The dependency direction is fixed:

```text
gridpulse-grid-core -> gridpulse-capacity-backtest -> production durable jobs -> React workflows
```

Public, synthetic and customer-assumption data remain nonclaims. Every canonical operational
result sets `automatic_live_dispatch_authorized` to `false`; Phase 8 and Phase 11 expose no
equipment-command transport. Operator confirmation and real pilot evidence remain external gates,
not values the software may synthesize.
