# Phase 4 — connection-option robustness

Phase 4 strengthens the existing option builder and decision matrix. It does not
create another options workflow.

Every profile-backed option now carries a deterministic low/base/high commercial
exposure range. The base case is the existing interval simulation; low and high
cases apply 50% and 200% exposure factors to make decision sensitivity visible.
These are inspectable scenarios, not probabilities or connection-cost forecasts.

When a validated interval profile is absent, the product reports insufficient
evidence and does not invent a range. Operator confirmation still controls all
network-capacity, connection-point, reinforcement, cost, and timing conclusions.
