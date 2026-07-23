# Phase 3 — flexible-load specification

Phase 3 extends the existing `flexibility_profiles`, `interval_profiles`, and
`flexibility_simulations` model. It does not introduce a second profile store.

The versioned specification now records load limits, event/recovery constraints,
ramp rates, workload transfer, battery state and efficiency, UPS, generator
support, economics, and the exact interval-profile version used by a simulation.
A deterministic validation report distinguishes blocking inconsistencies from
operational warnings and derives curtailment, dispatchable power, usable battery
energy, duration, and critical-load coverage.

These values are customer-declared or derived. They are not utility-confirmed
hosting capacity, a connection offer, or permission to operate.
