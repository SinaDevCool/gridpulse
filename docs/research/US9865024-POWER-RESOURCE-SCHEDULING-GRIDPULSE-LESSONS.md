# US 9,865,024 B2 - Power Resource Scheduling: GridPulse Lessons

## Source and review status

- **Patent:** US 9,865,024 B2, *Systems and Methods of Determining Optimal Scheduling and Dispatch of Power Resources*
- **Issued:** January 9, 2018
- **Application:** US 14/216,138
- **Priority:** March 15, 2013, through provisional application US 61/792,575
- **Inventors:** Sasan Mokhtari, Ali Ipakchi, Abdolhossein Rahimi, Guillermo Irisarri, Jose Medina Palomo, Behnam Danai, Nelson Muller, and Farrokh Albuyeh
- **Assignee at issue:** Open Access Technology International, Inc. (OATI)
- **Local source PDF:** `tmp/pdfs/US9865024.pdf`
- **Review performed:** Complete 13-page patent, including three figures, specification, optimization equations, examples, and all 14 issued claims

## Executive conclusion

This patent describes a multi-timescale economic-dispatch engine that jointly schedules conventional generation, demand response, distributed energy resources, storage, market transactions, and operating reserves.

Its best role in GridPulse is **scheduling resources within an already feasible connection envelope**. It does not itself discover or certify unused physical network capacity for a data center.

The strongest GridPulse lessons are:

- schedule at day-ahead, day-of, and real-time horizons;
- recalculate schedules when important forecasts or grid conditions change;
- model ramp rates, durations, derates, reserves, and resource costs;
- avoid committing the same capacity simultaneously to energy and multiple reserve products;
- calculate flexibility delivered at the point of common coupling, not merely nameplate flexibility;
- retain power-factor and phase-connectivity information for DERs and flexible loads; and
- maintain a separate study mode for scenario analysis and backtesting.

## The problem addressed

Power-system operators must meet electrical demand subject to resource, operational, regulatory, and network constraints. Traditional economic-dispatch systems principally scheduled conventional generation. The patent seeks to extend that scheduling process to include:

- conventional generators;
- demand response;
- distributed energy resources;
- electrical and thermal storage;
- power purchases and sales;
- bilateral contracts;
- market-based trades;
- spinning reserve;
- imbalance-energy capacity; and
- renewable generation forecasts.

The computation seeks to minimize operating costs and interchange imbalances while meeting forecast demand and reserve requirements.

## System architecture

Figure 1 depicts an application and computation engine connected to:

- EMS and SCADA systems;
- DR/DER management systems;
- energy markets;
- trading systems;
- operations systems;
- a database;
- a user interface; and
- reporting and external operational systems.

Inputs flow through application interfaces into a database and computation engine. Calculated schedules are stored, displayed, reported, or exported to EMS/SCADA and DR/DER management systems for execution.

Figure 2 shows the workflow:

1. import power-resource data;
2. organize and save the data;
3. identify imported triggers or define user triggers;
4. detect trigger events;
5. calculate or recalculate dispatch schedules;
6. format and export the schedules; and
7. generate reports.

Figure 3 provides a generic computer implementation with a central processing unit, memory, and database.

## Required input data

The disclosed system can receive:

- load forecasts, including losses;
- renewable-generation forecasts;
- committed generator output;
- generator availability, outages, and derates;
- generator minimum and maximum output;
- ramp-up and ramp-down capability;
- generation cost curves;
- reserve and regulation requirements;
- DR and DER committed schedules;
- DER total capacity, ramp rate, duration, availability, constraints, and cost;
- market prices and locational marginal price forecasts;
- trading positions and scheduled or unscheduled deals;
- interchange schedules;
- trade-hub limits;
- accumulated imbalance; and
- manual, periodic, or automatic execution triggers.

The preferred embodiment can use average, low, and high load and renewable forecasts. The average forecast produces the expected schedule, while the high and low cases help determine energy-imbalance requirements and their marginal cost.

## Three scheduling timescales

### Day-ahead

- Horizon can extend from the next hour to seven or eight days.
- Typical resolution is one hour.
- Schedules generation, storage, demand response, reserves, and trades.
- Uses forecast demand, renewable output, resource availability, outages, costs, and market opportunities.

### Day-of

- Typical horizon is the next 8 to 12 hours.
- Typical resolution is one hour.
- Recalculates schedules with updated forecasts and operating information.

### Real-time

- Typical horizon is one to three hours.
- Preferred interval is five minutes.
- A three-hour horizon therefore contains 36 intervals.
- Produces generator base points, DR/DER schedules, trades, and identified supply or demand shortages.
- Adds a mechanism for correcting accumulated interchange imbalance.

For GridPulse, these horizons translate naturally into planning, day-ahead, intraday, and real-time versions of a data-center connection envelope.

## Core optimization formulation

The high-level objective is:

```text
minimize the sum, across resources and time, of C_i(P_i(t))
```

where:

- `P_i(t)` is the scheduled MW amount for resource `i` at time `t`;
- `C_i` is that resource's cost function;
- purchases and generation normally have positive cost;
- sales can have negative cost; and
- storage affects cost through charging and discharging.

Cost functions may be quadratic or piecewise linear. A negative total objective may represent net trading profit.

### Slack resource

The day-ahead and day-of formulation includes an additional slack resource representing any remaining deficit or excess. Operators or traders are expected to resolve this residual through purchases, sales, or other changes, after which slack should return to zero.

For GridPulse, slack must be treated as an explicit capacity shortfall or modeling failure. It must never silently make an infeasible data-center connection appear feasible.

## Demand, reserve, and capability constraints

### Demand balance

At each time step, scheduled resources must collectively meet total demand:

```text
sum(P_i(t)) = D(t)
```

### Reserve and imbalance requirements

The system can require total spinning reserve and imbalance-energy capability to meet specified requirements. A resource's scheduled energy, spinning reserve, and imbalance capacity must remain within its derated maximum capability.

The formulation also restricts reserve provision using maximum sustained ramp capability. This guards against assigning reserves to a resource that cannot deliver them quickly enough.

### Ramp constraints

Resource output cannot change faster than its allowed ramp-up or ramp-down rate:

```text
P_i(t) - P_i(t-1) <= ramp-up limit
P_i(t-1) - P_i(t) <= ramp-down limit
```

### Operating limits

Each resource remains between its time-dependent lower and upper capability limits, including outages and derates.

### Emissions

Emissions can be incorporated as a constraint or as a nonnegative penalty in the objective.

## Real-time accumulated imbalance correction

The real-time objective can add an accumulated imbalance correction term. It represents cumulative Area Control Error or inadvertent interchange that should be eliminated over a defined number of future dispatch intervals.

The system uses a tunable weighting factor to trade off immediate economic cost against correcting the accumulated error.

The broader GridPulse lesson is that a controller may need to repay earlier over- or under-delivery. The same concept applies to:

- battery state-of-charge restoration;
- deferred compute workload;
- cooling thermal rebound;
- interrupted industrial processes; and
- energy budgets imposed over a settlement interval.

## Event-triggered recalculation

Schedules may be recalculated periodically, manually, or automatically when a material event occurs. Example triggers include:

- load-forecast changes beyond a threshold;
- renewable-forecast changes beyond a threshold;
- changes to interchange schedules;
- changes in reserve or regulation requirements;
- generator outages or restorations;
- tie-line outages or restorations;
- relevant SCADA measurements crossing thresholds; and
- monitored equipment-status changes.

This is an important GridPulse principle: a capacity result is valid only while its material assumptions remain valid. Topology changes, outages, forecast deviations, sensor alarms, or DER non-delivery should trigger recalculation or automatic derating.

## Study or what-if mode

The patent describes a non-production study mode in which users can modify inputs and compare the results against a base run. Modifiable parameters include:

- system-load forecast;
- variable-generation forecast;
- reserve and regulation requirements;
- bilateral trades and prices;
- conventional-resource schedules and outages; and
- DER schedules.

Comparison outputs can include:

- marginal cost of serving load;
- marginal reserve cost;
- total operating cost;
- resource schedules; and
- excess or shortage.

GridPulse should implement this separation explicitly. Scenario and backtest results should be visibly marked as studies and must never overwrite approved or live operational schedules.

## Power factor and voltage-sensitive load example

The patent recognizes that dispatchable demand cannot always be treated as a simple subtraction from load.

Its example uses a 13.8 kV feeder with:

- 9 MW total load at initial unity power factor;
- 3 MW constant-impedance load;
- 3 MW constant-current load;
- 3 MW constant-power load;
- 900 kW of registered motor-load demand response; and
- 0.8 lagging power factor for the motor load.

Curtailing the motor changes reactive power and feeder voltage. The resulting voltage increase changes the consumption of the remaining voltage-sensitive loads. The patent's example calculates:

- 90 kW of increased constant-impedance demand;
- 45 kW of increased constant-current demand;
- zero change in constant-power demand; and
- 135 kW total offsetting load response.

It therefore reports effective demand response of:

```text
900 kW - 135 kW = 765 kW
```

The engineering lesson is strong even though some printed intermediate numerical values appear internally inconsistent or contain drafting/OCR errors:

> Registered or nameplate flexibility is not necessarily the net flexibility delivered at the point of common coupling.

GridPulse should calculate net delivered response after accounting for reactive power, voltage sensitivity, auxiliary consumption, network losses, rebound, and measurement uncertainty.

## Phase-unbalance example

The patent also addresses phase-specific DER dispatch. Its example assumes a phase-balanced 9 MW feeder with:

- 300 kW DR on Phase A;
- 270 kW DR on Phase B; and
- 330 kW DR on Phase C.

The first 810 kW can be allocated equally across the phases at 270 kW per phase. Dispatch above this level becomes unbalanced.

For a nominal 900 kW dispatch, the example assumes 30 kW of neutral losses, producing:

```text
900 kW - 30 kW = 870 kW net response
```

The printed patent uses “810 MW” in a location where the context clearly indicates 810 kW. This should be preserved as a source-text peculiarity in legal analysis but corrected in engineering calculations.

The GridPulse lesson is that an aggregate MW value must retain phase connectivity. A flexible portfolio concentrated on one phase is not electrically equivalent to a balanced three-phase portfolio.

## What the issued claims cover

The patent contains 14 claims:

- **Claim 1:** independent system claim;
- **Claim 8:** independent method claim;
- **Claims 2-7 and 9-14:** dependent claims adding cost and operational constraints.

At a high level, the independent claims require:

1. receiving EMS, SCADA, DR/DER, market, trading, and operational input data;
2. organizing that data;
3. creating or importing an execution trigger;
4. calculating dispatch schedules to minimize operating cost and imbalance;
5. formatting and sending schedules to another system;
6. facilitating reporting; and
7. dynamically optimizing resources using the stated cost-minimization formulation.

Dependent claims add:

- a quadratic cost function;
- demand and reserve constraints;
- resource ramp constraints;
- operating limits; and
- emissions constraints.

The technically interesting power-factor and phase-balancing examples are in the specification but are not prominent limitations of the independent claims.

### Legal caution

This is a technical research summary, not legal advice or a freedom-to-operate opinion. Current ownership, enforceability, maintenance, claim construction, prosecution history, jurisdiction, and later legal events require review by patent counsel.

## Direct lessons for GridPulse

### 1. Use multiple scheduling horizons

GridPulse should calculate:

- a planning/study capacity envelope;
- a day-ahead schedule;
- an intraday schedule using refreshed forecasts; and
- a real-time dispatch envelope.

### 2. Recalculate when assumptions change

Forecast deviations, outages, topology changes, reserve changes, telemetry thresholds, and flexible-resource failures should invalidate or derate earlier results.

### 3. Model net delivered flexibility

Derate nameplate flexibility for:

- reactive-power effects;
- voltage-sensitive load response;
- feeder and neutral losses;
- phase imbalance;
- auxiliary consumption;
- battery efficiency;
- workload and cooling rebound;
- telemetry and baseline uncertainty; and
- historical non-delivery.

### 4. Retain phase-level information

The resource ledger and network model should store phase connection, real and reactive capability, and phase-specific delivery instead of aggregating everything into a single three-phase MW value.

### 5. Prevent double counting

Energy dispatch, operating reserve, congestion relief, backup commitments, and emergency headroom may compete for the same physical resource. GridPulse must reserve capacity explicitly across products and operating states.

### 6. Model ramp rate and duration separately

For each flexible resource, store at least:

- available MW;
- usable MWh;
- response latency;
- ramp-up and ramp-down rate;
- maximum and minimum event duration;
- minimum recovery time;
- state of charge or other energy state;
- rebound or payback requirement; and
- availability confidence.

### 7. Make slack visible

Any unmet requirement should appear as an explicit shortfall with affected intervals and causes. A scenario using nonzero slack is not a feasible connection plan.

### 8. Separate study and production results

Study cases should be versioned, marked, and isolated from live schedules. Their assumptions, model version, forecast vintage, and triggering event should be retained for audit.

## What this patent does not solve

The patent is not a complete free-capacity or interconnection method. It does not disclose a comprehensive treatment of:

- nonlinear AC optimal power flow;
- transformer thermal aging;
- N-1 security and planned outages;
- protection coordination and fault duty;
- harmonics and power quality;
- interconnection queues and commercial allocation;
- probabilistic capacity guarantees;
- detailed battery state-of-charge dynamics, degradation, or efficiency;
- workload shifting and cooling thermal dynamics;
- rebound after demand response;
- protection-grade fail-safe controls; or
- validated production utility results establishing capacity accuracy.

Although network constraints are mentioned, the main mathematical disclosure and claims concern system-level economic dispatch. The feeder examples adjust effective DR delivery; they do not constitute a general network-capacity solver.

## Recommended position in the GridPulse stack

```text
Network-capacity engine
  -> determines firm and conditional connection envelopes
  -> includes AC constraints, contingencies, protection, queue, and uncertainty

Forecast and scheduling engine
  -> applies the multi-horizon principles from US 9,865,024
  -> allocates generation, storage, demand response, trades, and reserves
  -> detects shortfalls and trigger events

Real-time feedback controller
  -> maintains actual operation inside the scheduled envelope
  -> reacts to measured PCC power, voltage, current, and resource delivery

Verification and learning layer
  -> calculates net delivered flexibility at the PCC
  -> records phase effects, losses, rebound, and non-delivery
  -> recalibrates future availability and forecasts
```

## Relationship to previously reviewed sources

| Source | Primary contribution | Role in GridPulse |
|---|---|---|
| *Powernet for Distributed Energy Resource Networks* | Hierarchical central/local DER architecture | Overall coordination architecture |
| *Mapping Rule Estimation for Power Flow Analysis in Distribution Grids* | Physics-structured learned electrical mappings | Fast screening and model calibration |
| *Risk Limiting Dispatch with Ramping Constraints* | Forecast-updating, ramp-aware risk-limiting scheduling | Uncertainty-aware envelope scheduling |
| US20140343983A1 | Dynamic resource models, portfolio dispatch, baselines, and verification | Flexibility ledger and delivery accounting |
| US 10,516,269 B2 | Measurement-driven primal-dual DER control | Real-time activation under voltage, current, and PCC constraints |
| US 9,865,024 B2 | Multi-horizon economic dispatch with reserves, triggers, power-factor and phase-delivery adjustments | Scheduling resources within an approved connection envelope |

## Questions for implementation

1. Which planning, day-ahead, intraday, and real-time horizons should GridPulse support?
2. Which events automatically invalidate or derate a connection envelope?
3. How will resource capability be reserved across energy, grid relief, and backup services?
4. Which flexible resources require explicit phase and reactive-power models?
5. How will net PCC delivery be calculated and verified?
6. What rebound or accumulated-energy correction must follow dispatch?
7. How will infeasible intervals and slack be presented to users?
8. How will study cases be isolated from approved operational schedules?
9. What utility systems and protocols provide forecasts, topology, status, and dispatch confirmation?
10. Does the intended scheduling implementation require patent counsel's freedom-to-operate review?

## Bottom line

US 9,865,024 provides a useful structure for coordinating power resources across day-ahead, day-of, and real-time horizons. Its treatment of triggers, reserves, ramping, net delivered DR, power factor, and phase imbalance can materially improve the GridPulse scheduler and backtest.

It should not be presented as a method for proving that a data-center connection has free physical capacity. That conclusion must come from a separate, auditable network-capacity and interconnection analysis.
