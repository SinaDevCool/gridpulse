# US20140343983A1 Demand-Response Patent Application: GridPulse Research Notes

Status: working research note  
Purpose: preserve a detailed technical and claim-level review for later GridPulse comparison  
Last reviewed: 2026-08-20

## Source and legal-status caution

**Publication:** US 2014/0343983 A1  
**Title:** *System and a Method for Optimization and Management of Demand Response and Distributed Energy Resources*  
**Applicant/assignee:** AutoGrid  
**Inventors:** Amit Narayan, Henry Schwarz, Rajeev Kumar Singh, Vijay Srikrishna Bhat, and Abishek Bahl  
**Priority date:** 2011-09-16  
**U.S. publication date:** 2014-11-20  
**PDF:** https://patentimages.storage.googleapis.com/1f/65/73/61eda000d5740b/US20140343983A1.pdf  
**Google Patents:** https://patents.google.com/patent/US20140343983A1/en

The complete nine-page document was reviewed, including all three figures, the detailed description, sparse-signal formulation, and all 11 claims.

This is a published U.S. patent **application**, not an issued patent. Google Patents currently labels U.S. application `14/345,248` as abandoned, while cautioning that its legal-status data are not a legal conclusion. Related family members, continuations, prosecution records, and live foreign rights would require formal legal review.

This publication is not US Patent 9,692,233. It is a different AutoGrid patent-family document.

## Executive conclusion for GridPulse

The application describes a closed-loop demand-response/DER management platform called DROMS-RT. Its main architecture is:

```text
Utility and customer data
        -> dynamic resource models
        -> load and load-shed forecasts
        -> portfolio optimization
        -> dispatch
        -> baseline and delivery verification
        -> model feedback
```

The strongest useful idea for GridPulse is not a power-flow or capacity-discovery algorithm. It is the treatment of flexibility as a dynamic, uncertain, measurable service whose eligibility depends on forecast error, response characteristics, communication health, customer preferences, and verified historical delivery.

The application repeatedly refers to real-time power-flow control, but does not disclose network topology, AC/DC power flow, voltage constraints, transformer loading, contingency analysis, or connection-capacity calculations.

## Platform components

### Resource Modeler

The resource modeler maintains a dynamic inventory of demand-response resources, potentially tracking:

- resource type and location;
- facility type and use;
- connected load;
- historical load profile;
- historical response performance;
- response and ramp times;
- availability and advance notice;
- maximum event count and consecutive-event limits;
- contract terms and participation price;
- program enrollment and customer preferences;
- online/offline and opt-out status;
- communication/control health;
- day, time, weather, occupancy, and process conditions;
- on-site generation forecasts.

The model is unique per load and changes with current conditions.

### Forecasting Engine

The forecasting engine estimates:

- individual-customer load;
- aggregate portfolio load;
- individual available load shed;
- aggregate available load shed;
- associated prediction-error distributions.

It is described as using machine learning and operating with partial or delayed feeds. The application does not disclose a model architecture, training method, loss function, calibration process, or measured forecast accuracy.

### Optimizer

The optimizer receives resource constraints, forecasts, error distributions, preferences, costs, market information, and utility/ISO requirements. It selects a portfolio to provide services such as:

- peak reduction;
- congestion relief;
- contingency response;
- real-time balancing;
- regulation and ancillary services.

Potential objective terms include cost, reliability, customer loading preference, greenhouse-gas impact, or weighted combinations.

Approximate dynamic programming and robust approximate dynamic programming are mentioned, including avoidance of erratic dispatch or price trajectories. No implementable ADP formulation, state model, Bellman equation, algorithm, proof, or numerical validation is supplied.

### Dispatch Engine

The dispatch engine sends event or price signals across a customer portfolio, potentially generating market bids and operating across day-ahead and near-real-time horizons.

Mentioned channels/protocols include cellular, broadband, AMI, radio data systems, email, OpenADR, and Smart Energy Profile.

### Baseline Engine

The baseline engine estimates the counterfactual consumption that would have occurred without a demand-response event. It compares:

- forecast baseline;
- actual metered consumption;
- prediction-error distribution;
- commanded event.

It then estimates whether response occurred and how much was delivered. Results feed back into forecasting, resource availability, performance history, and settlement.

## Sparse-signal recovery concept

The application conceptually represents measured power as:

```text
x_t = y_t + e_t - r_t
```

where:

- `x_t` is measured consumption;
- `y_t` is predicted baseline;
- `e_t` is baseline prediction error;
- `r_t` is demand-response reduction.

The response is assumed small compared with total facility load and sparse across time. The ideal estimation concept combines a sparsity term with a likelihood/error term:

```text
minimize over r:
  number of nonzero response intervals
  + baseline-error negative log likelihood
```

The text then discusses replacing the difficult `L0` sparse problem with an `L1`-type relaxation. The PDF typography and disclosure are insufficient to reconstruct a complete production algorithm.

## Signal-to-noise ratio strategy

A small load reduction can be hidden by ordinary baseline variation. The application links baseline uncertainty directly to dispatch eligibility.

### Customer aggregation

When customer prediction errors are sufficiently independent, aggregating responses can reduce relative noise while preserving a common response signal.

### Time diversity

Settlement across multiple events can improve detectability if errors are sufficiently independent between events.

### Selective dispatch

Resources can be dispatched only during periods when their expected response is large enough relative to forecast error. The same customer may be eligible during stable overnight periods but ineligible during volatile daytime periods.

### Commitment sizing

Higher forecast error requires a larger response block to achieve adequate SNR. Lower forecast error can permit smaller dispatch units.

```text
baseline accuracy
  -> minimum measurable response
  -> resource eligibility/aggregation requirement
  -> dispatch decision
```

The application's statements about information-theoretic limits and particular SNR thresholds are not supported by experiments in the document.

## Figures

### Figure 1

Shows the feedback architecture connecting utility data, resource modeling, forecasting, optimization, dispatch, customer data, baseline estimation, and customer/utility interfaces.

### Figure 2

Shows facility, weather, occupancy, preference, program, location, health, and performance inputs feeding per-load dynamic resource models and then an aggregated portfolio producing pseudo-generation in response to a utility/ISO signal.

### Figure 3

Conceptually divides operation into:

- low SNR: increase response size through optimization;
- intermediate SNR: aggregate customers;
- high SNR: no enhancement required.

It is a conceptual drawing, not empirical evidence.

## Claims

There are 11 published claims:

- Claim 1: independent system claim;
- Claims 2-6: dependent system claims;
- Claim 7: independent method claim;
- Claims 8-11: dependent method claims.

### Independent claim 1

Claim 1 recites, in substance:

- a baseline engine for detecting demand reduction;
- utility-backend and customer-endpoint data;
- a resource modeler;
- an engine forecasting individual load and available shed;
- an engine detecting load reduction;
- an engine calculating optimal dispatch;
- an optimizer determining dispatch;
- a dispatch engine sending signals across a customer portfolio.

The claim appears to contain redundancy between an engine calculating optimal dispatch and an optimizer determining optimal dispatch.

### Independent claim 7

Claim 7 recites a method involving:

1. collecting available resource information;
2. identifying desirable participating resources;
3. forecasting aggregate load and individual load shed;
4. determining optimal dispatch under a cost function;
5. integrating utility/customer data for feedback and response identification.

### Dependent claims

The dependent claims add SaaS/web delivery, location and response characteristics, machine-learning forecasts, cost/reliability/preference/GHG objectives, utility meter-management data, market bids, event dispatch, and customer price signals.

Because the U.S. application is listed as abandoned, these published claims are not themselves enforceable issued U.S. patent claims. Patent-family and freedom-to-operate conclusions require qualified legal analysis.

## What is technically distinctive

The disclosed combination includes:

1. dynamic per-resource modeling;
2. individual load and shed forecasting;
3. prediction-error estimation;
4. portfolio optimization;
5. dispatch;
6. baseline/delivery verification;
7. closed-loop learning;
8. SNR-aware eligibility;
9. aggregation for measurable response.

The most specific thread is using baseline-error characteristics to decide whether individual or aggregated demand response is measurable and allowing that result to influence optimization and dispatch.

The overall forecast-optimize-dispatch-verify architecture is described more broadly and at a high level.

## Evidence and disclosure limitations

The application provides no empirical results for:

- forecast or load-shed accuracy;
- baseline detection accuracy;
- SNR enhancement;
- dispatch reliability;
- resource scale;
- optimizer runtime;
- congestion reduction;
- renewable integration;
- cost savings.

It also does not disclose detailed:

- machine-learning algorithms;
- robust-ADP algorithms;
- state transitions and constraints;
- power-flow equations;
- security design;
- telemetry architecture;
- settlement algorithms.

Claims of millions of clients, information-theoretic optimality, or improved grid resilience are assertions rather than validated results within this document.

## GridPulse lessons

### Dynamic flexibility ledger

GridPulse should store, per resource:

```text
electrical location
maximum response
response and ramp times
maximum duration
recovery/rebound behavior
energy budget or state of charge
notice requirement
availability window
event/rest limits
contract price and preferences
communication health
historical requested/delivered response
forecast error
opt-out status
```

### Forecast delivered response

GridPulse needs both:

```text
predicted baseline consumption
predicted delivered flexibility after dispatch
```

The second prediction should include response uncertainty and non-delivery probability.

### Separate commanded and verified response

Track:

- requested MW;
- acknowledged MW;
- measured consumption change;
- baseline-adjusted delivery;
- confidence interval;
- settlement-eligible delivery.

### Confidence-adjusted flexibility

A credible response can use a lower prediction bound:

```text
R_credible(i,t) = predicted response - confidence margin
```

Portfolio capacity should be based on credible delivery, not optimistic nameplate flexibility.

### Couple measurement quality to eligibility

When baseline noise is larger than the claimed response, GridPulse should aggregate resources, use direct telemetry, evaluate across events, increase the response block, or refuse certification at that resolution.

### Learn after every event

Update response probability, magnitude, delay, ramping, rebound, baseline error, and future eligibility after activation.

## Position in data-center capacity workflow

The application's concepts belong in the flexibility operations layer:

```text
1. Network model establishes physical/contingency headroom.
2. GridPulse identifies the binding constraint.
3. Flexible connection analysis determines required response.
4. Dynamic resource models identify eligible resources.
5. Optimizer dispatches confidence-adjusted flexibility.
6. Telemetry and baseline analysis verify delivery.
7. Performance feedback updates future credible capacity.
```

The document does not calculate:

- transformer or feeder headroom;
- voltage-limited hosting capacity;
- N-1 connection capacity;
- queue-adjusted or commercially available capacity;
- a data-center point-of-interconnection rating.

## Defensible GridPulse interpretation

The application supports:

> Flexible capacity should be dynamically modeled, probabilistically forecast, dispatched under resource constraints, verified against an estimated baseline, and derated when delivery or measurement uncertainty is high.

It does not support:

> The described platform can identify physically free data-center connection capacity without a separate network and interconnection model.

## Comparison record

| Dimension | Finding |
|---|---|
| Document type | Published U.S. patent application; U.S. case currently listed as abandoned |
| Core architecture | Resource model, forecast, optimize, dispatch, verify, learn |
| Most specific technique | Sparse baseline-response detection and SNR-aware aggregation/dispatch |
| Network physics | Claimed as an objective but not mathematically disclosed |
| Validation | No experimental results in the document |
| GridPulse role | Dynamic flexibility ledger, dispatch eligibility, baseline verification, delivery confidence |
| Capacity discovery role | None without a separate grid model |

## Questions to revisit

1. Which live patent-family members, if any, contain related enforceable claims?
2. How should GridPulse estimate delivered response without relying exclusively on a counterfactual whole-site baseline?
3. Can direct device and feeder telemetry replace or supplement statistical baseline settlement?
4. How should correlated customer errors change aggregation benefits?
5. What confidence level should define credible connection-support flexibility?
6. How should rebound and recovery be incorporated into delivery verification?
7. How should the flexibility ledger connect to GridPulse's physical network graph and binding constraints?
