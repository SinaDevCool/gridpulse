# Database-independent calculation correctness

This change continues the existing stateless Operations assessment engine. It does not apply migrations, connect to a live database, provision hosting, change billing, or enable dispatch. The public scenario endpoint can calculate entirely in memory; persistence remains a separate capability.

## Existing execution path

`src/routes/api.operations.assess.ts` validates and fingerprints a request, then calls `runOperationsAssessment` in `src/features/operations/operations-service.ts`. The overview path uses the existing scenario engine and battery dispatcher. Compute uses the existing workload assessment. The Python `facility_plan` handler delegates to the external `capacity_backtest.application.run_facility_plan`; that private engine is not replaced or claimed to be tested here.

## Corrections

- Battery configuration bounds and SOC relationships are shared between direct dispatcher calls and scenario requests, instead of being enforced only at the HTTP/scenario boundary.
- Invalid/nonfinite powers, ambiguous timestamps and invalid instants fail before dispatch. Durations use elapsed UTC time, including Germany's repeated autumn clock hour.
- The dispatcher retains full precision for downstream math and exposes starting/ending energy and actual duration for audit. Numerical formatting belongs to presentation.
- An idle or blocked interval no longer erases direction history and bypasses minimum dwell time.
- An unavailable asset or inverter exposes zero charge/discharge capability.
- Scenario envelopes use start-of-interval energy and the same health-adjusted capacity as battery dispatch. They previously used end-of-interval SOC and omitted the health factor from energy.
- Workload recovery is a mandatory load. It consumes headroom and response capacity before an envelope is called feasible. Recovery can make combined headroom lower than battery-only headroom; it is not clamped away as optional demand.
- Calculation identity is bumped to `operations-backend-v5-energy-consistent` so cached assessments do not silently reuse old numerical semantics.

## Numerical conventions

The existing scenario assumes `usableEnergyMwh` is the capacity before the configured state-of-health derating; effective capacity is `usableEnergyMwh * stateOfHealthPercent / 100`. Reserve and maximum SOC are fractions of this effective capacity. Positive AC battery power means discharge:

```
grid_import = facility_demand - battery_power
E_end = E_start - battery_power / discharge_efficiency * hours  # discharge
E_end = E_start + (-battery_power) * charge_efficiency * hours  # charge
```

The final interval uses the explicit supplied duration; other intervals use the difference between consecutive timestamps. No duration is invented from local timezone settings. The ramp rule remains the existing discrete-interval rule, not a continuous inverter transient simulation. A hard energy/headroom conflict is reported, not silently converted into a feasible ramp trajectory.

## Verification and boundaries

Tests include independent hand-calculated charge/discharge examples, degraded capacity and reserve bounds, fractional power conservation, irregular durations, daylight-saving offsets, zero capacity, invalid inputs, unavailable equipment, dwell transitions, and 40 seeded mixed-demand days (3,840 interval energy-balance checks). Envelope tests compare demand/recovery/resource combinations against an independent response budget. Local API tests check deterministic numerical repeats, input fingerprint changes, configuration errors and disabled physical dispatch without Supabase access.

These are software regression checks, not real-facility or equipment acceptance. Scenario demand remains synthetic and aggregate workload shifting is not proof of individual job completion. The envelope is interval-local, not a multi-interval guarantee; ramp/dwell/charging trajectory feasibility remains part of dispatch and canonical scheduling. The private engine artifact, independent facility benchmarks and real-data replay remain unavailable prerequisites for validating the complete production optimizer.

## Repeatable local validation

Run `npm run build`, then `npm run test:operations:runtime`. The dedicated Playwright configuration starts the compiled Worker on loopback port 3004 with remote bindings disabled. No Supabase credentials are required; API tests calculate in memory and check that persistence rejects unauthenticated requests. CI uses the same command after its build. UI regression tests remain on the existing Vite server and are run separately.

This split follows a reproducible local Vite/Miniflare proxy `ECONNRESET` after an early authentication response. The complete five-test sequence passes against the compiled Worker. No retries, reordered tests, weakened authentication, vendor patches, or production request-handling workarounds are used to mask that development-proxy issue. It remains a development-tool limitation, not a certified fix to the proxy itself.

Validation for this iteration: 411 unit tests passed across 120 files; all 33 Operations browser regression checks passed. The five compiled-Worker API checks passed both against an explicitly started local Worker and with the dedicated configuration managing its own server. Type checking, application lint, architecture boundaries, text encoding, production build and performance budgets passed. Existing browser console caveats remain described in VALIDATION.md; a passing test is not a clean-console guarantee.
