# Phase 4.5 — Pilot-ready architecture

## Product boundary

GridPulse converts customer project data into an inspectable connection-options and operator-engagement record. It does not infer firm or conditional network capacity. Network limits, connection points, dates and flexible-agreement parameters remain controlling only when supplied or confirmed by the responsible network operator.

## Workflow

1. Import a CSV or XLSX interval profile.
2. Inspect timezone, interval, coverage, unit, missing-data and spike quality results.
3. Record technical configuration, minimum viable import, ramp-up and flexibility constraints.
4. Compare candidate locations on maturity, evidence completeness, flexibility compatibility and operator-engagement readiness.
5. Model requested-firm, reduced-firm, static-flexible and dynamic-flexible options.
6. Attach evidence versions and resolve technical, commercial and grid-expert review items.
7. Rehearse non-production restriction events using fixture limits.
8. Export a versioned operator-engagement package and capture pilot metrics.

## Persistence

- `candidate_sites`: technical configuration, ramp stages, flexibility constraints and review stage.
- `interval_profiles`: versioned source profile, checksum, mapping and quality report.
- `assessment_documents`: evidence versions, visibility, expiry and checksum.
- `assessment_reviews`: role-aware challenges and approvals.
- `operations_simulations`: non-production event fixtures and results.
- `pilot_metrics`: measurable workflow and review outcomes.
- `integration_events`: provenance-preserving Phase 5 adapter boundary.

## Phase 5 adapter contracts

All external messages use a versioned integration envelope with:

- event kind;
- controlling organization;
- evidence state;
- validity period;
- recorded timestamp;
- payload;
- explicit operator-validation requirement.

Supported initial kinds are network limits, capacity evidence, project submissions, telemetry and dispatch responses. Phase 4.5 uses fixtures only. No SCADA, EMS, BMS or workload-control command is issued.

## Approval gate

The lifecycle is:

`Draft → Customer complete → Technical review → Expert review → Operator ready → Superseded`

Operator-ready status requires every review item to be accepted and at least one accepted grid-expert review. This is readiness for engagement, not operator approval.

## Acceptance evidence

- Unit tests cover quality reporting, candidate truth boundaries, operational-event calculations and approval gates.
- Desktop Playwright covers the coherent pilot workspace and operator-package export.
- The authenticated assessment profile room accepts CSV and XLSX files and stores the resulting version and quality report.
