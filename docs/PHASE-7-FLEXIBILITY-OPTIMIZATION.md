# Phase 7 — flexible-load candidate optimization

Phase 7 adds a `flexibility_optimization` job to the existing authenticated
analytics API. It ranks only operating envelopes supplied by the customer or
operator against interval demand, critical load, shiftable workload, battery
power/energy, and declared energy value.

The response includes the selected supplied candidate, the complete ranked audit
table, residual unserved energy, critical-load breaches, commercial exposure,
methodology version, and limitations.

The optimizer never creates or predicts network capacity. Its battery dispatch is
a deterministic screening approximation and must not be used as an equipment
control instruction. Operator validation and detailed engineering remain
required.
