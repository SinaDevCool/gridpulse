# US 10,734,816 B2 - DR Operability Failure Detection: GridPulse Lessons

## Source and review status

- **Patent:** US 10,734,816 B2, *Identifying Operability Failure in Demand Response (DR) Assets*
- **Issued:** August 4, 2020
- **Application:** US 14/442,904
- **Priority:** November 14, 2012, through provisional application US 61/726,023
- **Inventors:** Amit Narayan, Vijay Bhat, and Henry Schwarz
- **Original assignee:** AutoGrid Systems, Inc.
- **Local source PDF:** `tmp/pdfs/US10734816.pdf`
- **Review performed:** Complete nine-page patent, including both figures, the statistical model, mathematical assumptions, Bayesian update, operating architecture, and all 14 issued claims
- **Status note:** Google Patents listed the U.S. patent as active with an adjusted expiration in 2035 when reviewed on August 20, 2026. Google expressly warns that its legal-status listing is not a legal conclusion.

## Executive conclusion

This patent is directly relevant to GridPulse's **flexibility credibility and operability-detection layer**.

It does not determine unused physical network capacity. Instead, it estimates whether a demand-response participant's control device is probably non-operable based on repeated event performance, historical interval-meter data, and an estimated counterfactual baseline.

Its central two-stage method is:

```text
Population mixture model
        +
Participant event history
        +
Bayesian updating
        =
Probability of persistent DR non-delivery
```

For GridPulse, the main lesson is that flexible resources should not be credited at full nameplate capacity merely because they are enrolled or received a dispatch command. Their dependable contribution should be derated using verified delivery history, baseline uncertainty, communications condition, and suspected operability failure.

## Problem addressed

Demand-response programs can include thousands or millions of switches, signal receptors, thermostats, controllers, and other dispatchable assets. Some of those devices will fail or stop producing the expected response.

A load-serving entity can:

- inspect every participant site, which is expensive and difficult to scale;
- wait for participants to report failures, which can leave poor performance undetected; or
- infer likely device failures from interval-meter and historical event data.

The patent implements the third approach. It attempts to identify customers that have a high probability of belonging to a non-operable population so inspections and remedial actions can be targeted.

## Broader DROMS-RT architecture

Figure 1 places the invention within a Demand Response Optimization and Management System for Real-Time, or DROMS-RT.

The architecture contains:

- utility data feed;
- customer data feed;
- resource modeler;
- forecasting engine;
- optimizer;
- dispatch engine;
- baseline engine; and
- customer/utility interface.

The patent describes this as a scalable, web-based platform supporting program design, implementation, event execution, forecasting, optimization, dispatch, and post-event analytics.

### Resource modeler

The resource modeler tracks:

- available resources;
- resource type and location;
- response and ramp times;
- existing event commitments;
- notification requirements;
- maximum event counts;
- consecutive-event restrictions;
- customer preferences;
- contractual participation prices;
- online or offline status; and
- customer opt-outs.

It updates resource availability when resources are committed to or released from events and can create a loading order reflecting customer preferences and contract terms.

### Forecasting engine

The forecasting engine produces:

- participant-level baseline forecasts;
- aggregate-load forecasts;
- expected load reduction;
- expected shed duration;
- rebound estimates; and
- forecast-error distributions.

The specification describes online customer profiles that are updated as additional meter and event data become available.

### Optimization and dispatch

The optimizer combines:

- available resources;
- contractual and operational constraints;
- individual load and load-shed forecasts;
- forecast-error distributions;
- cost;
- reliability;
- resource loading-order preferences; and
- greenhouse-gas considerations.

It may select DR resources for peak-load management, balancing, regulation, or other ancillary services across day-ahead and near-real-time horizons.

This platform description is useful context, but the issued claims focus more narrowly on statistical detection of non-operable devices.

### Baseline engine

The baseline engine estimates what each participant would have consumed if no demand-response event had occurred. It compares this counterfactual estimate with actual meter readings to determine:

- whether the participant responded; and
- how much load was reduced.

The measured result feeds back into forecasting and operability analysis.

## Operability Analysis Engine

Figure 2 shows the principal invention:

```text
Historical interval-meter data
              +
Historical DR-event data
              +
Participant baseline estimates
              ↓
Calculate observed event response
              ↓
Fit two-population mixture model
              ↓
Estimate population distributions and prior probabilities
              ↓
Apply participant-level Bayesian updates
              ↓
Failure-probability report
              ↓
Target inspection or remediation
```

## Observed event response

For event `i` and participant `j`, the method uses:

- `b(i,j)`: estimated participant baseline load; and
- `a(i,j)`: actual realized load.

The observed percentage reduction is conceptually:

```text
x(i,j) = [b(i,j) - a(i,j)] / b(i,j)
```

A positive value suggests load reduction. A value near zero suggests little response. A negative value means actual consumption exceeded the estimated baseline.

One poor result does not prove device failure because both the baseline and customer response are uncertain. The method therefore combines evidence across a portfolio and across multiple events.

## Two-population mixture model

The patent assumes two latent populations.

### Population A: operable devices

Participants with working devices should produce a load reduction on average. Their observed outcome includes:

- baseline-estimation error;
- the average load-shed multiplier; and
- participant and event response variability.

The patent expresses the observed load as a product of lognormal factors:

```text
observed load
  = baseline
  × baseline-error factor
  × average response multiplier
  × response-variability factor
```

Taking logarithms turns this multiplicative expression into an additive normal model. Conceptually:

```text
log(response) ~ Normal(
  mean operable response,
  baseline-error variance + response variance
)
```

### Population B: non-operable devices

For non-operable devices, the model assumes no genuine DR-induced load reduction. Observed changes are attributed principally to baseline error:

```text
log(response) ~ Normal(
  zero response,
  baseline-error variance
)
```

Thus the operable population contains baseline error plus response variability, while the non-operable population contains baseline error without the genuine response component.

## Expectation-Maximization fitting

The system does not initially know:

- which participant belongs to which population;
- the average response of operable devices;
- baseline-error variance;
- response variability; or
- the portfolio proportions of operable and non-operable devices.

An Expectation-Maximization algorithm estimates:

- mean response for the operable population;
- baseline-error variance;
- additional response variance;
- mixture weight for operable devices; and
- mixture weight for non-operable devices.

It then constructs cumulative distribution functions for both populations.

This is latent-class inference rather than supervised physical diagnosis. The model separates response patterns without requiring every historical device to be pre-labeled as working or broken.

## Bayesian participant update

The patent then updates the probability that each participant belongs to the non-operable population.

The described procedure:

1. estimates the probability of a negative load-shed outcome for the operable population;
2. estimates that probability for the non-operable population;
3. counts a participant's positive or negative outcomes across `N` events;
4. applies a binomial likelihood to each population;
5. uses mixture weights as prior probabilities; and
6. applies Bayes' rule.

Conceptually:

```text
P(failed | history)
  =
  P(history | failed) × P(failed)
  ─────────────────────────────────────────────
  P(history | working) × P(working)
  + P(history | failed) × P(failed)
```

Each additional event can update the participant's posterior probability. The system outputs a ranked report so high-risk participants can be inspected or remediated.

## What “failure” actually means

The patent refers to mechanical or device failure. Statistically, the method detects persistent non-response consistent with the inferred non-operable population.

A high failure probability could also be caused by:

- failed communications;
- incorrect resource enrollment;
- unrecorded customer override;
- opt-out status not represented correctly;
- meter failure;
- poor baseline forecasts;
- changed site operations;
- insufficient controllable load;
- state-of-charge or other energy constraints;
- rebound inside the measurement interval; or
- systematic under-delivery for another reason.

GridPulse should therefore label the result as:

```text
suspected operability failure probability
```

or:

```text
probability of persistent non-delivery
```

It should not assert a specific mechanical failure without independent diagnosis.

## What the issued claims cover

The patent has 14 method claims. The independent claims are **Claims 1, 5, and 12**.

### Claim 1

At a high level, Claim 1 requires:

- collecting interval data through utility and customer feeds;
- generating two subsets representing operable and non-operable devices;
- determining cumulative distributions for both populations;
- calculating a customer failure probability through Bayesian updates;
- using historical meter data and a baseline load;
- applying the method to switches or signal receptors;
- observing a customer subset selected using the probability; and
- taking remedial action for customers with high failure probability.

### Claim 5

Claim 5 more expressly requires:

- segmenting a dataset into operable and non-operable populations;
- expressing the populations as lognormal distributions;
- estimating variance values and mixture weights;
- deriving cumulative distributions;
- performing Bayesian updates;
- identifying probable failures; and
- taking remedial action.

### Claim 12

Claim 12 focuses on:

- utility and customer meter data;
- operable and non-operable subsets;
- participant baseline estimates;
- observed percentage load shed;
- negative-response probabilities;
- binomial calculations across event history;
- identification of customers probably belonging to the non-operable population; and
- remedial action.

Dependent claims add:

- large-scale data storage;
- lognormal cumulative distributions;
- EM calculation of variances and mixture weights;
- probability of negative load shed; and
- participant histories across multiple DR events.

The “observing a subset” and “taking remedial action” elements are important. The claims do not end with generating a statistical score.

### Legal caution

This note is a technical research summary, not legal advice or a freedom-to-operate opinion. Current ownership, legal status, maintenance, claim construction, prosecution history, jurisdiction, and later legal events require patent counsel.

## Direct lessons for GridPulse

### 1. Create a resource-reliability score

Every flexible resource should receive a continuously updated score using:

- dispatch-command history;
- expected response;
- device-measured response;
- PCC-measured response;
- baseline uncertainty;
- response latency;
- sustained duration;
- rebound;
- communications health;
- customer opt-outs and overrides; and
- repeated non-delivery.

### 2. Distinguish command, expectation, and delivery

For every event, GridPulse should separately record:

- MW requested;
- command acknowledgement;
- MW expected;
- MW measured at the device;
- MW measured at the PCC;
- baseline forecast and uncertainty;
- response latency;
- sustained duration;
- rebound energy; and
- updated suspected-failure probability.

### 3. Derate dependable flexibility

Firm or dependable flexibility should not equal the sum of resource nameplates. A resource with repeated under-delivery should receive:

- a lower availability weighting;
- additional reserve requirements;
- reduced dispatch priority;
- an inspection or remediation flag; or
- exclusion from firm capacity until cleared.

An illustrative calculation is:

```text
nominal flexible capability:       10 MW
expected delivered response:        8 MW
persistent non-delivery risk:      20%
illustrative dependable credit:   6.4 MW
```

The actual derating formula must be calibrated and validated rather than copied from this illustration.

### 4. Target inspections by operational value

GridPulse can rank inspections using a measure such as:

```text
inspection value
  ≈ suspected-failure probability
    × capacity at risk
    × event criticality
```

This prioritizes a probable 10 MW failure supporting a binding connection constraint over a low-impact household device.

### 5. Maintain multiple failure causes

GridPulse should improve on a binary working/failed model by classifying:

- healthy and responsive;
- partially responsive;
- intermittent;
- physically failed;
- communications failure;
- customer override;
- opted out;
- state-of-charge constrained;
- unavailable due to site operations;
- telemetry failure;
- insufficient baseline confidence; and
- response delivered but obscured by rebound.

### 6. Use hierarchical models

Response distributions should be grouped or partially pooled by:

- device type;
- manufacturer and model;
- firmware version;
- site type;
- climate region;
- tariff;
- event duration;
- time of day;
- season;
- communications provider; and
- control strategy.

This avoids forcing unlike resources into one two-component population model.

## Important limitations

The method depends heavily on baseline quality. Failure probabilities can be distorted by:

- nonstationary customer behavior;
- sparse historical event data;
- site equipment changes;
- weather dependence;
- selection bias in dispatched participants;
- rebound contaminating measurement windows;
- correlated customer errors;
- mislabeled opt-outs;
- meter gaps; and
- overlapping site or grid events.

The two-population lognormal model may also be too simple. Real resources may be:

```text
fully operational
partially operational
intermittent
communications impaired
customer overridden
energy constrained
completely failed
```

The patent does not provide a quantitative field-validation study, confusion matrix, false-positive rate, probability-calibration curve, sample-size sensitivity analysis, or demonstrated financial savings from targeted repairs.

GridPulse should validate any implementation using labeled maintenance outcomes and out-of-sample events.

## What this patent does not solve

The patent does not determine unused physical connection capacity. It does not model:

- AC power flow;
- voltage limits;
- feeder and transformer thermal headroom;
- N-1 contingencies;
- protection constraints;
- interconnection queues;
- detailed battery duration and degradation; or
- data-center cooling and workload flexibility.

Its proper role is downstream of the capacity calculation:

```text
Capacity engine
  -> What conditional capacity could the network support?

Resource scheduler
  -> Which flexible resources are needed to maintain it?

Operability engine
  -> How much of that promised flexibility should be trusted?

Verification engine
  -> What response was actually delivered?
```

## Recommended GridPulse data additions

For each flexible resource, add or verify support for:

- `nominal_power_mw`;
- `expected_delivered_power_mw`;
- `dependable_power_credit_mw`;
- `baseline_model_id`;
- `baseline_estimate_mw`;
- `baseline_uncertainty_mw`;
- `dispatch_requested_mw`;
- `dispatch_acknowledged_at`;
- `response_measured_mw`;
- `pcc_response_attributed_mw`;
- `response_latency_seconds`;
- `sustained_duration_seconds`;
- `rebound_energy_mwh`;
- `communications_state`;
- `opt_out_state`;
- `suspected_failure_probability`;
- `suspected_failure_cause`;
- `inspection_priority`; and
- `last_verified_at`.

## Relationship to previously reviewed sources

| Source | Primary contribution | Role in GridPulse |
|---|---|---|
| *Powernet for Distributed Energy Resource Networks* | Hierarchical central/local DER architecture | Overall coordination architecture |
| *Mapping Rule Estimation for Power Flow Analysis in Distribution Grids* | Physics-structured learned electrical mappings | Fast screening and model calibration |
| *Risk Limiting Dispatch with Ramping Constraints* | Forecast-updating, ramp-aware risk-limiting scheduling | Uncertainty-aware envelope scheduling |
| US20140343983A1 | Dynamic resource models, portfolio dispatch, baselines, and verification | Flexibility ledger and delivery accounting |
| US 10,516,269 B2 | Measurement-driven primal-dual DER control | Real-time activation under voltage, current, and PCC constraints |
| US 9,865,024 B2 | Multi-horizon economic dispatch with reserves and event triggers | Scheduling within an approved connection envelope |
| US 11,025,089 B2 | Three-level central, peer-to-peer, and autonomous microgrid failover | Threat-conditioned capacity and resilient control |
| US 10,734,816 B2 | Two-population mixture model and participant-level Bayesian failure updates | Flexibility credibility, operability detection, dependable-capacity derating, and targeted remediation |

## Questions for implementation

1. What constitutes a response event for batteries, HVAC, UPS systems, generators, and workload controllers?
2. Which baseline model and measurement window apply to each resource type?
3. How will GridPulse distinguish physical failure from communications loss, opt-out, and energy constraints?
4. How many events are required before changing dependable-capacity credit?
5. How should failure probability translate into MW derating and reserve margins?
6. How will selection bias from non-random dispatch be handled?
7. Which maintenance outcomes provide ground-truth labels for calibration?
8. What false-positive rate is acceptable before initiating an inspection?
9. How will new resources with no event history receive an initial reliability prior?
10. Does the intended implementation require patent counsel's freedom-to-operate review?

## Bottom line

US 10,734,816 provides a concrete statistical pattern for converting historical event performance into a probability of persistent DR non-delivery. GridPulse should use that principle to prevent unreliable flexibility from being counted at full nameplate value.

The patent strengthens the credibility of conditional data-center capacity by answering:

> Of the batteries, HVAC controls, UPS systems, generators, or workload controllers required to maintain this connection envelope, how much response is statistically dependable, and which resources require inspection or remediation?

It does not replace the separate network-capacity, protection, contingency, queue, or interconnection analysis needed to determine how much capacity can connect.
