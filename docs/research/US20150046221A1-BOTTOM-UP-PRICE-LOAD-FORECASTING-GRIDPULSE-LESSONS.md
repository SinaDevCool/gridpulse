# US20150046221A1 - Bottom-Up Price-Based Load Forecasting: GridPulse Lessons

## Source and review status

- **Publication:** US 2015/0046221 A1, *Load Forecasting from Individual Customer to System Level Based on Price*
- **Published:** February 12, 2015
- **Application:** US 14/345,235
- **Priority:** September 17, 2011, through provisional applications US 61/535,949 and US 61/535,946
- **Inventors:** Amit Narayan, Scott Christopher Locklin, Vijay Srikrishna Bhat, and Henry Schwarz
- **Applicant/assignee:** AutoGrid, Inc.
- **Local source PDF:** `tmp/pdfs/US20150046221A1.pdf`
- **Review performed:** Complete 12-page publication, including all six drawing sheets, forecasting architecture, machine-learning descriptions, dynamic resource model, interface examples, scale estimate, and all 20 published claims
- **Status note:** Google Patents listed the U.S. application as abandoned when reviewed on August 20, 2026. The 20 claims in this publication are application claims, not issued U.S. patent claims.

## Executive conclusion

This application is highly relevant to GridPulse's load-forecasting, flexibility-modeling, and backtesting methodology.

Its main idea is to forecast electricity demand from the bottom up:

```text
Individual customer or device forecasts
                  ↓
Transformer forecast
                  ↓
Feeder forecast
                  ↓
Substation forecast
                  ↓
System forecast
```

Each customer receives a self-calibrating profile intended to learn ordinary consumption, reaction to dynamic prices, expected load reduction, ramp time, shed duration, rebound, pre-cooling, load shifting, and fatigue from repeated events.

For GridPulse, the strongest principle is:

> Forecast data-center demand and flexibility at the controllable-device or subsystem level, preserve spatial and electrical aggregation, quantify uncertainty, and model the entire pre-event, response, rebound, and recovery trajectory.

The application provides a broad architecture, but it does not disclose enough equations, training detail, performance metrics, or validation evidence to be an implementation-complete forecasting method.

## Legal and evidentiary posture

This document is a published U.S. patent application, not an issued patent. Google Patents lists the application as abandoned. Its 20 published claims should not be described as enforceable issued claims.

The technical disclosure can still be useful as prior-art and product-methodology research. Patent-family status and freedom-to-operate questions require a separate legal review.

## Problem addressed

Aggregate load forecasts commonly use variables such as:

- time of day;
- day of week;
- season;
- weather;
- historical demand; and
- broad customer class.

The application argues that these variables are insufficient when customers face dynamic prices or personalized demand-response offers.

Customers can react differently to the same signal:

- reduce demand;
- shift demand to an earlier or later period;
- pre-cool a building;
- ignore the price;
- respond only at a sufficiently high price;
- respond initially and then become fatigued; or
- opt out because of operational preferences.

The system therefore builds individualized price-responsive profiles rather than treating the entire customer class as one average load.

## DROMS-RT architecture

Figure 1 shows the Demand Response Optimization and Management System for Real-Time, or DROMS-RT.

Its principal components are:

- utility data, models, sensors, and databases;
- forecasting engine;
- resource modeler;
- optimization engine;
- dispatch engine;
- baseline computation and settlement engine;
- customer data feed; and
- customer/utility interface.

### Resource modeler

The resource modeler maintains a unified portfolio of resources across multiple DR programs. For each resource, it can track:

- resource type and location;
- connected load;
- facility type and use;
- response and ramp time;
- advance-notice requirements;
- event-count restrictions;
- consecutive-event restrictions;
- user preferences;
- contract terms and price;
- online/offline state;
- opt-out state;
- historical load profile;
- prior DR performance;
- time and day;
- weather;
- on-site generation;
- occupancy;
- communications health; and
- current event commitments.

The resource representation changes with current conditions, notice time, customer preferences, and recent participation.

### Forecasting engine

The forecasting engine receives the available-resource list and produces:

- individual customer-load forecasts;
- aggregate-load forecasts;
- baseline forecasts;
- available load-shed forecasts;
- error distributions;
- ramp estimates;
- response-duration estimates; and
- rebound estimates.

The engine can operate with live feeds, partial feeds, or offline data.

### Optimization engine

The optimizer combines:

- resource availability;
- operational and contractual constraints;
- individual load forecasts;
- load-shed forecasts;
- forecast-error distributions;
- customer loading-order preferences;
- cost and market data;
- reliability; and
- greenhouse-gas considerations.

It may select resources for peak management, balancing, regulation, ancillary services, or wholesale-market bids over day-ahead and near-real-time horizons.

The application refers broadly to robust optimization but does not provide a reproducible mathematical formulation.

### Dispatch engine

The dispatch engine sends price or DR signals to customer endpoints based on forecast capability, optimization results, cleared bids, grid requirements, and resource constraints.

### Baseline and settlement engine

The baseline engine estimates what consumption would have been without an event. It compares that counterfactual baseline with actual meter readings to:

- detect participation;
- estimate delivered reduction;
- verify contractual performance; and
- feed results back into the forecasting engine.

## Individual customer model

Historical load and event data produce a self-calibrated model for each customer.

Potential conditioning variables include:

- time of day;
- day of week;
- day of year and season;
- weather and temperature;
- dynamic price;
- event notice;
- customer class;
- past participation;
- event duration;
- consecutive events;
- occupancy;
- facility type;
- customer preference;
- equipment state; and
- communications health.

The customer profile is stochastic. It should produce both:

```text
expected load or load reduction
```

and:

```text
forecast-error distribution
```

The error distribution is intended to support portfolio optimization and verification.

## Price elasticity

The application attempts to model customer-specific price elasticity: how much a customer changes demand in response to price or an incentive.

GridPulse should distinguish:

- technical flexibility;
- willingness to respond at a given price;
- contractual availability;
- site-operator approval; and
- actual delivered response.

A resource can be technically capable but economically or operationally unavailable.

Historical correlation between price and demand should not automatically be treated as causal elasticity. High-price events may occur during unusual weather or system conditions, and dispatched customers may be selected non-randomly. GridPulse should use randomized trials, instrumental variables, causal forests, difference-in-differences, or other defensible causal approaches where price response materially affects capacity credit.

## Pre-cooling, load shifting, and rebound

The application explicitly describes a building pre-cooling before a high-price period.

```text
Pre-event:
  cooling demand increases

During event:
  cooling demand decreases

After event:
  thermal recovery and possible rebound
```

This is directly relevant to data centers. A load reduction can create:

- pre-cooling demand;
- deferred compute workload;
- battery or UPS recharge;
- thermal rebound;
- post-event demand peaks; and
- delayed restoration of operational reserves.

GridPulse backtests must model the complete trajectory:

```text
preparation
  → curtailment
  → sustained response
  → release
  → rebound
  → energy-state restoration
```

An event should not be considered successful merely because load stayed below an envelope during the curtailment interval.

## Customer fatigue

The application proposes learning reduced customer response when events are frequent, consecutive, or excessively long.

GridPulse should generalize this to:

- battery cycle and state-of-charge depletion;
- growing deferred-work backlog;
- reduced cooling tolerance;
- equipment wear;
- operator overrides;
- maximum annual event counts;
- minimum recovery intervals; and
- contractual participation fatigue.

Flexibility after multiple consecutive events can be materially lower than flexibility during the first event.

## Segmentation and clustering

The method segments customer and event data into related time series using variables such as:

- seasonality;
- time of occurrence;
- price index;
- temperature;
- customer characteristics;
- event type; and
- other regression parameters.

Named clustering methods include:

- K-means; and
- fuzzy K-means.

Fuzzy clustering can be useful because a site may exhibit different behavioral regimes rather than belonging permanently to one customer class.

## Forecasting algorithms named

The application names:

- ARIMAX;
- K-nearest neighbors;
- support-vector machines;
- artificial neural networks; and
- combinations of these models.

### ARIMAX

Useful for time-series forecasting with external variables such as weather, price, calendar, occupancy, and event indicators.

### K-nearest neighbors

Forecasts current conditions using historically similar time periods or events.

### Support-vector machines

Provides nonlinear curve fitting with some resistance to noisy observations.

### Artificial neural networks

Proposed for portfolios with substantial training data.

The application lists these model families but does not disclose complete features, hyperparameters, loss functions, training procedures, validation splits, or model-comparison results.

## Hierarchical aggregation

Individual forecasts are aggregated to:

- transformer;
- feeder;
- substation; and
- system levels.

This can help geographically and electrically locate expected imbalances.

However, simply summing independent forecasts is insufficient. GridPulse should use hierarchical reconciliation so that all levels agree:

```text
sum(customer forecasts) = transformer forecast
sum(transformer forecasts) = feeder forecast
sum(feeder forecasts) = substation forecast
```

Uncertainty must also retain correlations. Treating customer errors as independent can greatly understate portfolio risk during common weather, price, communications, or control events.

Recommended methods to evaluate include:

- bottom-up reconciliation;
- top-down reconciliation;
- optimal-combination reconciliation;
- MinT reconciliation;
- copula or factor models for correlated errors; and
- scenario-based joint forecast trajectories.

## Figure 6: dynamic DR resource model

Figure 6 shows a unique dynamic resource model per load using inputs including:

- facility type and use;
- connected load;
- historical load profiles;
- day and time;
- prior DR performance;
- outside-air temperature;
- weather forecast;
- on-site generation forecast;
- measured and scheduled customer data;
- occupancy;
- customer preferences;
- DR-program choices;
- communications-system health; and
- site location.

The portfolio is controlled to produce “pseudo-generation” in response to a utility or ISO signal.

GridPulse should use that term cautiously. Reduced demand can support a connection envelope, but it is not physically identical to generation because it has baseline, duration, rebound, recovery, and customer-availability constraints.

## Data-scale discussion

Figure 5 gives a rough storage estimate using millions of smart meters and 15-minute interval data. The text says the portfolio may generate data at petabyte scale.

The application mentions:

- MonetDB;
- KDB;
- Xenomorph;
- Hadoop;
- MapReduce;
- distributed computation; and
- dimensionality reduction.

These are historically specific implementation suggestions from the 2011-2015 period. GridPulse should retain the principles of scalable time-series ingestion, distributed model training, and compact features without treating the named technologies as current requirements.

The figure and prose are back-of-the-envelope capacity planning, not a benchmark with measured throughput, latency, cost, or production reliability.

## What the published claims cover

The application contains 20 published method claims. Because the application is listed as abandoned, they are not issued U.S. patent claims.

### Published Claim 1

At a high level, Claim 1 covers:

- recording customer DR participation history;
- segmenting event data into related time series;
- building a self-calibrated customer model;
- using feedback to predict load-profile changes; and
- forecasting load, load shed, and forecast-error distributions using machine learning and data mining.

Dependent claims add:

- detailed resource characteristics;
- time, seasonality, temperature, and price;
- K-means and fuzzy K-means;
- notice requirements;
- weather;
- rebound;
- ARIMAX, KNN, SVM, and neural networks; and
- AMI and distribution-grid sensors.

### Published Claim 12

At a high level, Claim 12 covers:

- collecting periodic electricity data at each customer;
- aggregating it at transformer, feeder, and substation levels;
- creating customer profiles using estimated price elasticity;
- clustering customer time series; and
- forecasting customer and aggregate demand.

Dependent claims add dynamic-price DR, participation strategy, customer-level profiles, named machine-learning methods, clustering variables, and summation of individual forecasts.

### Legal caution

This note is a technical research summary, not legal advice. Abandonment of this U.S. application does not answer every patent-family, foreign-rights, continuation, or prior-art question. Patent counsel should review any freedom-to-operate issue.

## Direct lessons for GridPulse

### 1. Forecast data-center demand bottom-up

Model at least:

- IT compute;
- cooling and chillers;
- pumps and fans;
- UPS losses;
- battery charging and discharging;
- network infrastructure;
- safety and security systems;
- offices and ancillary loads;
- on-site generation; and
- scheduled maintenance.

Reconcile these components with facility, PCC, transformer, feeder, and substation measurements.

### 2. Create dynamic flexibility profiles

For every resource, forecast:

- available MW;
- usable MWh;
- response latency;
- ramp rate;
- maximum duration;
- rebound;
- recovery time;
- fatigue;
- uncertainty;
- availability by price;
- operator-override probability; and
- communications health.

### 3. Preserve spatial and electrical aggregation

Forecast and verify at:

- device;
- subsystem;
- data hall;
- facility;
- PCC;
- transformer;
- feeder;
- substation; and
- capacity zone.

### 4. Store probabilistic forecasts

Each forecast should retain:

- expected value;
- quantiles or prediction interval;
- exceedance probability;
- correlated portfolio uncertainty;
- forecast horizon;
- model version and training vintage;
- missing-data state; and
- scenario assumptions.

### 5. Validate the complete trajectory

Backtests should measure:

- pre-event preparation energy;
- response latency;
- delivered MW;
- sustained duration;
- baseline uncertainty;
- rebound peak and energy;
- recovery duration;
- battery state restoration; and
- deferred-work completion.

## Important limitations

The application does not provide:

- a complete forecasting equation;
- a detailed price-elasticity estimator;
- an explicit robust-optimization formulation;
- complete training and validation methods;
- benchmark datasets or sample sizes;
- MAE, RMSE, MAPE, quantile loss, or coverage results;
- comparisons against aggregate forecasting;
- treatment of correlated portfolio errors;
- hierarchical reconciliation;
- causal identification of price response; or
- production-deployment evidence.

Claims of accuracy, reliability, stability, or efficiency are not supported by a disclosed empirical evaluation in this publication.

## What this application does not solve

It does not determine free physical connection capacity. It lacks detailed treatment of:

- AC power flow;
- voltage constraints;
- transformer thermal aging;
- feeder ampacity;
- N-1 contingencies;
- protection and fault duty;
- interconnection queues;
- commercial allocation; and
- reinforcement options.

Its proper role in GridPulse is:

```text
Bottom-up probabilistic forecasting
  -> predict site demand and flexible-resource behavior

Network-capacity engine
  -> determine the load the network can safely support

Scheduler and controller
  -> maintain planned and actual load inside the envelope

Verification and learning
  -> measure response, rebound, and forecast error
  -> recalibrate customer and resource profiles
```

## Recommended GridPulse data additions

For each forecastable load or flexible resource, add or verify support for:

- `electrical_parent_id`;
- `resource_type`;
- `facility_subsystem`;
- `connected_power_mw`;
- `baseline_forecast_mw`;
- `baseline_forecast_quantiles`;
- `flexibility_forecast_mw`;
- `flexibility_forecast_quantiles`;
- `price_response_curve`;
- `response_latency_seconds`;
- `ramp_rate_mw_per_minute`;
- `maximum_duration_minutes`;
- `rebound_power_mw`;
- `rebound_energy_mwh`;
- `recovery_time_minutes`;
- `consecutive_event_count`;
- `fatigue_factor`;
- `opt_out_probability`;
- `communications_state`;
- `forecast_model_id`;
- `model_training_vintage`; and
- `hierarchical_reconciliation_run_id`.

## Relationship to previously reviewed sources

| Source | Primary contribution | Role in GridPulse |
|---|---|---|
| *Powernet for Distributed Energy Resource Networks* | Hierarchical central/local DER architecture | Overall coordination architecture |
| *Mapping Rule Estimation for Power Flow Analysis in Distribution Grids* | Physics-structured learned electrical mappings | Fast screening and model calibration |
| *Risk Limiting Dispatch with Ramping Constraints* | Forecast-updating, ramp-aware risk-limiting scheduling | Uncertainty-aware envelope scheduling |
| US20140343983A1 | Dynamic resource models, portfolio dispatch, baselines, and verification | Flexibility ledger and delivery accounting |
| US 10,516,269 B2 | Measurement-driven primal-dual DER control | Real-time activation under voltage, current, and PCC constraints |
| US 9,865,024 B2 | Multi-horizon economic dispatch with reserves and event triggers | Scheduling within an approved connection envelope |
| US 11,025,089 B2 | Three-level microgrid-control failover | Threat-conditioned capacity and resilient control |
| US 10,734,816 B2 | Mixture-model and Bayesian operability inference | Flexibility credibility and dependable-capacity derating |
| US20150046221A1 | Customer-level price-responsive forecasting aggregated through the electrical hierarchy | Bottom-up demand/flexibility forecasting, rebound, fatigue, and probabilistic backtesting |

## Questions for implementation

1. Which data-center subsystems require separate bottom-up load models?
2. What electrical hierarchy connects devices, halls, facilities, PCCs, transformers, feeders, and substations?
3. Which price responses are causally established rather than merely correlated?
4. How will forecast coherence be enforced across hierarchy levels?
5. How will common weather and communications errors be represented jointly?
6. How should pre-cooling, deferred compute, recharge, and rebound be modeled?
7. How does flexibility decay across consecutive or prolonged events?
8. Which forecast quantiles drive firm versus conditional capacity?
9. What backtest metrics and out-of-sample periods are required before deployment?
10. Are there related family patents or foreign rights requiring legal review despite abandonment of this U.S. application?

## Bottom line

US20150046221A1 contributes a valuable GridPulse design principle:

> Build dynamic device- or customer-specific forecasts of demand and flexibility, condition them on price, weather, time, event history, rebound, and fatigue, and reconcile them upward through the electrical-network hierarchy.

GridPulse should adopt this bottom-up probabilistic architecture while adding modern validation, causal price-response estimation, hierarchical reconciliation, correlated uncertainty, explicit network constraints, and complete backtesting of pre-event preparation, response, rebound, and recovery.
