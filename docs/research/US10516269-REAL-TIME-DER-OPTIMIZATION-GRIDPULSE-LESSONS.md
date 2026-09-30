# US 10,516,269 B2 — Real-Time DER Optimization: GridPulse Lessons

## Source and review status

- **Patent:** US 10,516,269 B2, *Real Time Feedback-Based Optimization of Distributed Energy Resources*
- **Issued:** December 24, 2019
- **Application:** US 15/814,532
- **Earliest listed priority:** November 16, 2016
- **Inventors:** Emiliano Dall'Anese, Andrey Bernstein, and Andrea Simonetto
- **Original assignees:** Alliance for Sustainable Energy, LLC / National Renewable Energy Laboratory and Université catholique de Louvain
- **Local source PDF:** `tmp/pdfs/US10516269.pdf`
- **Review performed:** Full 29-page PDF, including specification, equations, five drawing sheets, and all 18 issued claims
- **Status note:** Google Patents listed the U.S. patent as active when reviewed on August 20, 2026, with anticipated expiration in 2037. Legal status must be independently confirmed before relying on it.

## Executive conclusion

This patent is highly relevant to the **real-time activation and enforcement** layer of GridPulse, but it is not a method for discovering how much new data-center capacity exists at a connection point.

Its central idea is an online feedback controller that repeatedly:

1. measures actual grid conditions;
2. increases mathematical "constraint-pressure" coefficients when voltage, current, or point-of-common-coupling power limits are violated;
3. broadcasts those coefficients to distributed energy resources;
4. lets each DER or aggregator calculate a new real- and reactive-power setpoint within its own feasible region; and
5. uses the next measurements to correct model error and continue tracking a time-varying optimum.

For GridPulse, the best interpretation is:

> A slower capacity engine determines a feasible, uncertainty-adjusted connection envelope. A faster controller based on this patent's principles can then coordinate batteries, inverters, and flexible load so the data center stays inside that envelope.

The controller cannot create capacity when the underlying network problem is infeasible. Firm and flexible connection capacity still require topology, equipment ratings, AC power flow, contingencies, protection, queue assumptions, uncertainty, and intertemporal storage analysis.

## The problem being solved

The patent addresses time-varying optimal control of DERs on an unbalanced, multiphase distribution network. It seeks to minimize DER or aggregator operating costs while satisfying grid-level constraints such as:

- lower and upper voltage bounds;
- line-current or ampacity bounds;
- desired real-power exchange at the point of common coupling;
- individual DER real- and reactive-power capability limits; and
- aggregate flexibility limits.

The architecture accommodates individual DERs and aggregations, including inverter-connected generation, batteries, and controllable devices. It supports single-phase and three-phase resources, wye and delta connections, and unbalanced multiphase networks.

## Architecture described in the patent

The figures depict a distribution feeder containing sensors, a point of common coupling, individual DER controllers, and aggregate DER controllers. A utility or aggregator controller receives measurements and communicates control information to DERs.

The control can be organized in several ways:

- centrally by a utility;
- centrally by an aggregator;
- through distributed local DER controllers; or
- as a hybrid in which the grid operator broadcasts system-level coefficients while private device objectives and constraints remain local.

The specification mentions practical communications such as DNP3 and Modbus. The distributed formulation has a useful privacy property: a device need not reveal its full cost function or operating details if it can receive the relevant coefficients and calculate its setpoint locally.

## Measurements and constraint-pressure coefficients

The feedback loop may use measurements of:

- voltage magnitude at selected nodes or phases;
- current magnitude on monitored lines;
- real-power exchange at the point of common coupling; and
- related network quantities needed by the controller.

The controller maintains nonnegative coefficients associated with grid constraints. Conceptually:

- an **undervoltage coefficient** grows when measured voltage falls below its minimum;
- an **overvoltage coefficient** grows when voltage exceeds its maximum;
- a **line-current coefficient** grows when current exceeds its bound;
- a **lower PCC-power coefficient** grows when real power is below the desired tolerance band; and
- an **upper PCC-power coefficient** grows when real power is above that band.

The generic update has the form:

```text
new coefficient = projection_to_nonnegative(
  previous coefficient
  + step size × measured constraint violation
  - regularization term
)
```

Projection onto the nonnegative orthant prevents a constraint price from becoming negative. Regularization makes the online saddle-point problem better behaved and helps establish contraction and tracking results.

These variables can be understood as live signals showing where the network is under stress. They are not merely dashboard alerts: they influence the gradient used by DERs to choose their next setpoints.

## DER feasible regions and local control

Each DER receives relevant coefficients and computes a real- and reactive-power command by a projected-gradient step. The calculation combines:

- the gradient of the DER's private cost or utility function;
- network sensitivity terms;
- the broadcast constraint coefficients; and
- projection back into the DER's feasible operating region.

For an inverter-connected resource, the feasible set can include:

```text
Pmin ≤ P ≤ Pmax
P² + Q² ≤ S²
```

where `P` is real power, `Q` is reactive power, and `S` is the inverter apparent-power rating. This prevents the optimizer from requesting an electrically impossible combination of real and reactive power.

For GridPulse, the important lesson is that connection-capacity activation should control both `P` and `Q` where inverter capability exists. A megawatt-only controller can miss voltage support, apparent-power saturation, and the tradeoff between active and reactive power.

## Aggregated and discrete resources

The patent supports aggregations of many DERs. The aggregate feasible region is mathematically related to the Minkowski sum of individual device regions. Because an exact aggregate region may be difficult to calculate or communicate, conservative inner approximations can be used.

Once an aggregate command is selected, a local disaggregation step allocates the command among devices, commonly by minimizing the sum of their individual operating costs subject to meeting the aggregate request.

Discrete resources are treated by relaxing their implementable set to a convex hull and then mapping a relaxed setpoint back to a realizable action, for example through randomization or selection of a nearby discrete point. The specification's theoretical treatment depends on assumptions that bound the average error introduced by this conversion.

GridPulse should favor a conservative inner aggregate envelope. It is better to advertise 18 MW of flexibility that can always be disaggregated than 22 MW that exists only in a mathematical outer approximation.

## Network model

The specification begins from nonlinear, multiphase AC power-flow relationships. For online controller construction, it uses linear or linearized sensitivity models for quantities such as:

- nodal voltage;
- line current; and
- real power at the point of common coupling.

This is a hybrid modeling pattern:

1. use a tractable model to calculate fast control directions;
2. measure the real network;
3. feed observed constraint errors back into the optimizer; and
4. continually correct for bounded model and measurement error.

This does not make the linear model exact. It makes the controller less dependent on perfect modeling because actual measurements repeatedly close the loop.

## Time-varying optimization and primal-dual feedback

At each time step, the underlying problem is a constrained optimization:

- minimize the sum of DER and aggregator costs;
- keep every device inside its feasible set;
- maintain voltage within bounds;
- maintain line current within ampacity limits; and
- track a PCC-power reference or tolerance band.

The patent constructs a regularized Lagrangian. DER setpoints act as primal variables, while the nonnegative constraint coefficients act as dual variables. The controller performs online primal and dual updates rather than waiting for a static optimization problem to converge completely before the network changes.

This makes the method suitable for continuously changing loads, renewable generation, prices, setpoints, and feasible regions—provided those changes are not too fast relative to the controller's ability to track them.

## Theoretical guarantees and their conditions

The disclosed analysis gives a conditional Q-linear tracking result: if the update operator is a contraction, the iterates approach a neighborhood of the time-varying optimal trajectory. The final neighborhood grows with factors such as:

- model and measurement error;
- regularization bias;
- discrete-setpoint approximation error; and
- the speed at which the true optimum moves over time.

The result is not an unconditional guarantee of safe operation. Important assumptions include:

- convex, compact DER feasible sets, or suitable convex relaxations;
- convex and sufficiently smooth cost functions, with regularization where needed;
- feasibility of the network-constrained optimization at each time;
- a Slater-type strict-feasibility condition;
- bounded model and measurement errors;
- sufficiently slow variation of operating conditions;
- appropriate primal and dual step sizes;
- adequate communications and DER setpoint tracking; and
- extra geometric or averaging assumptions for discrete controls.

The specification explicitly motivates checking feasibility at a slower timescale. This distinction is crucial: real-time feedback can track a feasible operating region, but it cannot manufacture a feasible solution when the requested data-center import exceeds physical capability.

## What is actually claimed

The issued patent contains 18 claims. The principal independent claims are:

- **Claim 1:** a control device;
- **Claim 9:** a system; and
- **Claim 16:** a method.

At a high level, the independent claims require receiving voltage and PCC-power measurements, maintaining lower/upper voltage and PCC-power constraint coefficients using prior coefficient values and scaled measurement offsets with nonnegative projection, and causing DER setpoints to change based on those coefficients.

Dependent claims add elements such as:

- a current-constraint coefficient;
- phase-specific measurements and control;
- explicit coefficient-update equations;
- local calculation of DER setpoints;
- aggregation and cost-based disaggregation;
- inverter-connected DERs; and
- particular sensing arrangements.

### Legal caution

This note is a technical research summary, not a freedom-to-operate opinion or legal advice. Claim scope depends on prosecution history, claim construction, ownership, maintenance, jurisdiction, and later legal events. Patent counsel should review any production control implementation.

There is also an apparent drafting peculiarity in the text of claims 1 and 16: language for the second power-related coefficient appears to reference a previous second voltage-constraint coefficient. The surrounding specification suggests a power coefficient was intended, but GridPulse should preserve the issued wording and leave legal interpretation to counsel.

## Direct lessons for GridPulse

### 1. Separate capacity discovery from capacity activation

GridPulse needs at least two distinct layers:

- **Capacity discovery/certification:** determine firm and conditional headroom using network models, equipment ratings, N-1 cases, uncertainty, queue assumptions, protection constraints, and storage duration.
- **Capacity activation/control:** coordinate flexible resources in real time so actual import remains inside the approved envelope.

US 10,516,269 is strongest in the second layer.

### 2. Express the connection as a time-varying PCC envelope

Instead of one static number, the slower GridPulse engine can produce a schedule such as:

```text
PCC import must remain between P_lower(t) and P_upper(t)
```

The fast controller then uses measured PCC power plus voltage and current measurements to dispatch batteries, flexible compute, cooling, and inverter reactive power.

### 3. Expose constraint pressure, not only violations

GridPulse can maintain interpretable live variables for:

- undervoltage pressure;
- overvoltage pressure;
- transformer or feeder ampacity pressure;
- PCC envelope pressure; and
- later, state-of-charge and rebound pressure.

These can power both the controller and an operational explanation layer showing which constraint is currently binding.

### 4. Measure the contractual boundary directly

A controller should measure real power at the data center's PCC rather than infer compliance only by summing device telemetry. The latter can miss unmodeled loads, auxiliary systems, losses, telemetry dropouts, and device non-delivery.

### 5. Preserve conservative aggregate deliverability

The DER portfolio should publish an inner feasible envelope that can actually be disaggregated to devices. The dispatch engine should verify that battery, UPS, cooling, generator, and workload commands can jointly deliver the advertised net response.

### 6. Use feedback to correct model mismatch

Linear sensitivities can be useful for fast control, but measured voltage, current, and PCC power should continuously correct the controller. Residuals should also be logged to recalibrate GridPulse's network surrogate and confidence bands.

### 7. Put feasibility ahead of optimization

Before the fast loop receives an envelope, a slower safety gate should confirm that the operating problem remains feasible under the required network state and contingency assumptions. If not, the system should derate the envelope, curtail load, or enter a defined fallback mode.

## Critical additions GridPulse still needs

The patent does not provide a complete data-center capacity product. GridPulse must add:

- battery state of charge, energy duration, efficiency, degradation, and reserve constraints;
- multi-period workload shifting and cooling thermal dynamics;
- rebound and payback after curtailment;
- forecast uncertainty and chance/risk constraints;
- N-1 and planned-outage scenarios;
- transformer thermal aging and emergency ratings;
- protection, fault-duty, harmonics, and power-quality checks;
- interconnection-queue and commercial-allocation rules;
- cyber-security and authorization controls;
- auditable baselines and delivered-response verification; and
- explicit fallback behavior for sensor, communications, or device failures.

The real-time implementation should also include:

- stale-data detection;
- communication-loss modes;
- coefficient caps and anti-windup behavior;
- oscillation detection and damping;
- minimum dwell times for discrete devices;
- manual operator override;
- fail-safe default setpoints;
- command acknowledgement and delivery verification; and
- a complete event and model-version audit trail.

## Suggested GridPulse control stack

```text
Planning / study layer
  -> AC power flow, contingencies, protection, queue, uncertainty
  -> firm and conditional connection capacity

Envelope layer (minutes to hours)
  -> forecast-aware PCC import bounds
  -> battery energy reservation and workload/cooling plan
  -> feasibility gate and confidence derating

Feedback activation layer (seconds to minutes)
  -> measure PCC power, voltages, and monitored currents
  -> update constraint-pressure coefficients
  -> compute P/Q requests for DERs and aggregations
  -> project onto implementable device regions

Verification layer
  -> confirm delivered response at the PCC
  -> record constraint margins, model residuals, and failures
  -> update forecasts, baselines, and surrogate calibration
```

## Relationship to the previously reviewed sources

| Source | Primary contribution | Role in GridPulse |
|---|---|---|
| *Powernet for Distributed Energy Resource Networks* | Hierarchical central/local DER architecture and rolling-horizon coordination | Overall control architecture |
| *Mapping Rule Estimation for Power Flow Analysis in Distribution Grids* | Physics-structured learned mappings and residual correction | Fast screening and model calibration |
| *Risk Limiting Dispatch with Ramping Constraints* | Forecast-updating, ramp-aware, risk-limiting scheduling | Day-ahead and intraday envelope scheduling |
| US20140343983A1 | Dynamic resource models, portfolio dispatch, baselines, and verification | Flexibility ledger and delivery accounting |
| US 10,516,269 B2 | Measurement-driven primal-dual DER control under voltage, current, and PCC constraints | Real-time activation of an already feasible connection envelope |

Together, these sources suggest a coherent GridPulse design, but none alone calculates or certifies free data-center connection capacity.

## Questions to resolve before implementation

1. Which measurements exist at the proposed PCC, feeder, transformer, and critical voltage nodes?
2. What sampling and command interval can the utility and site reliably support?
3. How will sensitivities be obtained and updated when topology changes?
4. Which constraints are hard safety limits versus soft economic targets?
5. How will battery energy and workload rebound be coupled to the instantaneous `P/Q` controller?
6. What happens when the envelope becomes infeasible after a contingency?
7. How conservative must the aggregate inner approximation be?
8. How are controller step sizes tuned and stability tested across delay and packet loss?
9. What independent protection layer remains outside optimization control?
10. Does the intended implementation require a patent freedom-to-operate review?

## Bottom line

US 10,516,269 provides a rigorous and practical pattern for closing the loop between grid measurements and DER commands. GridPulse should use the concept as a model for **operating conditional capacity safely in real time**, with interpretable voltage, current, and PCC constraint pressures. It should not cite the patent as proof that a proposed connection has available capacity. That conclusion must come from a separate, auditable network-capacity and interconnection analysis.
