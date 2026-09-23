# US 11,025,089 B2 - Resilient Microgrid DER Management: GridPulse Lessons

## Source and review status

- **Patent:** US 11,025,089 B2, *Distributed Energy Resource Management System*
- **Issued:** June 1, 2021
- **Application:** US 16/555,002
- **Priority:** November 13, 2018, through provisional application US 62/760,087
- **Inventors:** Ulrich Münz and Xiaofan Wu
- **Assignee at issue:** Siemens Aktiengesellschaft
- **Local source PDF:** `tmp/pdfs/US11025089.pdf`
- **Review performed:** Complete 10-page patent, including both system diagrams, the three-layer resilience architecture, forecasting and cyber-security sections, restoration logic, and all 11 issued claims

## Executive conclusion

This patent describes a resilient hierarchical microgrid-control architecture that progressively decentralizes control when central communications or grid infrastructure fail.

It is not primarily an economic-dispatch patent or a method for discovering initial data-center connection capacity. Its principal contribution to GridPulse is a framework for calculating and operating **state-dependent capacity** under physical disasters, cyberattacks, communications failures, islanding, and black-start restoration.

The defining architecture has three protection layers:

1. central situational awareness and microgrid coordination during normal operation;
2. peer-to-peer coordination between microgrid controllers after loss of the central controller or primary communications; and
3. autonomous local microgrid control if peer-to-peer communication also fails.

The strongest GridPulse lesson is:

> Available capacity should be expressed by operating state and resource capability, not as one permanent MW value.

## The problem addressed

Large power-system outages can result from:

- hurricanes, fires, earthquakes, and other natural events;
- damaged transmission or distribution lines;
- loss of substations or generation;
- cyberattacks;
- failure of central control;
- communications outages; and
- unpredictable behavior from increasingly distributed generation.

Traditional centralized grids depend heavily on long transmission and distribution lines and central control. The patent uses distributed generation, storage, microgrid control, situational awareness, and communications failover to improve resilience and accelerate restoration.

## System components

The disclosed architecture can include:

- a bulk generation system;
- substations;
- multiple microgrids;
- one microgrid controller for each microgrid;
- a high-level Microgrid Management System;
- an energy management system;
- photovoltaic generation;
- battery energy storage;
- wind generation;
- diesel or gas generation;
- building management systems;
- controllable and critical loads;
- grid-forming inverters;
- EMS, SCADA, and phasor measurements;
- all-sky cameras and pyranometers;
- weather and external threat information; and
- three levels of communication and control.

Each microgrid controller can be positioned at, or conceptually associated with, the transformer connecting its microgrid to the higher-voltage network. That transformer is treated as the point of common coupling. The controller manages internal resources and the net exchange through that boundary.

## Three-layer protection architecture

### Layer 1: Central situational awareness

During normal operation, the high-level Microgrid Management System coordinates the participating microgrids through a first communication network.

It gathers information from:

- microgrid controllers;
- substations;
- bulk generation facilities;
- EMS and SCADA;
- phasor measurement units;
- weather services;
- historical storm-damage data;
- known infrastructure weaknesses;
- cyber-security monitoring; and
- DER and load forecasts.

The central system can:

- monitor component state of health;
- predict or detect physical failures;
- detect and localize cyberattacks;
- calculate resilience metrics;
- determine possible microgrid-to-microgrid transfers;
- calculate countermeasures;
- redispatch resources before a predictable event; and
- coordinate normal system operation.

For example, if a line has elevated wildfire-failure probability, the system can calculate a redispatch that reduces flow on that line before it fails.

### Layer 2: Peer-to-peer microgrid coordination

If the high-level controller or primary communication network is unavailable, a separate second network provides direct communication between microgrid controllers.

Collectively, the controllers may perform:

- distributed primary-reserve allocation;
- distributed secondary voltage control;
- distributed frequency control;
- distributed optimal power flow;
- congestion management;
- power transfers between microgrids;
- restoration coordination; and
- allocation of local generation to critical loads.

The specification describes starting from a centralized optimal-power-flow problem and distributing the computation among microgrid controllers. Controllers exchange information with neighboring controllers to pursue network-wide voltage, frequency, and congestion objectives.

### Layer 3: Autonomous local operation

If peer-to-peer communications also fail, a third communication network inside each microgrid supports local control.

At this level, a microgrid attempts to:

- supply local critical loads;
- shed noncritical loads;
- restore and maintain frequency;
- control voltage and reactive power;
- dispatch surviving DERs;
- operate without external communications;
- perform an autonomous black start;
- restore loads progressively; and
- reconfigure control functions as equipment and communications recover.

The degradation sequence is:

```text
Central coordination available
            ↓ central control or network failure
Peer-to-peer microgrid coordination
            ↓ peer-to-peer communications failure
Autonomous local microgrid operation
```

## Resource capability assessment

Each microgrid controller continuously estimates the capability and health of its local system. Inputs can include:

- battery state of charge;
- available diesel or gas generation;
- wind generation;
- long-term and short-term PV forecasts;
- maximum resource power;
- inverter grid-forming capability;
- ability to shed noncritical load;
- communications availability;
- resource response to previous commands; and
- local critical-load requirements.

The controller can estimate whether the microgrid can:

- supply its own critical loads;
- supply noncritical loads;
- provide voltage regulation;
- provide frequency control;
- establish an islanded grid;
- black-start the local network; and
- export support to neighboring microgrids.

For GridPulse, each resource therefore needs a capability vector rather than one capacity field.

An illustrative battery capability record could include:

```text
instantaneous real power:     20 MW
remaining usable energy:      40 MWh
reactive-power capability:    ±8 MVAr
export after critical loads:  15 MW
grid-forming capable:         yes
black-start capable:          conditional
estimated support duration:   2 hours
communications state:         healthy
```

## Resilience metrics

The patent proposes measuring resilience according to the critical and noncritical loads that remain supplied under predefined threats or contingencies.

The assessment is approximately:

1. Each microgrid estimates its local generation and critical-load requirements.
2. It communicates its capability to the central controller.
3. The central controller calculates possible transfers from surplus to deficient microgrids.
4. The calculation considers network power-flow constraints.
5. The system applies physical and cyber-threat scenarios.
6. Resilience is quantified by the loads that remain supplied.

One suggested type of metric is the percentage of critical or noncritical load that cannot be supplied following a contingency.

GridPulse should therefore report:

- normal firm capacity;
- normal flexible capacity;
- N-1 capacity;
- weather-derated capacity;
- islanded critical-load capacity;
- exportable emergency capacity;
- capability after loss of central communications;
- black-start-capable capacity; and
- expected hours of critical-load survival.

## Forecasting approach

### Long-term solar forecasting

- Approximate horizon: 1 to 14 days.
- Uses meteorological forecasts.
- Supports preparation, resource reservation, and pre-event redispatch.

### Short-term solar forecasting

- Approximate horizon: 15 to 30 minutes.
- Uses all-sky cameras and pyranometers near PV systems.
- Segments clouds and estimates cloud motion.
- Calculates the probability that clouds will cover the sun.
- Combines cloud probability with a clear-sky index to forecast irradiance and PV production.

The patent recognizes that one imager becomes less representative as PV systems become more geographically dispersed. Multiple sensors improve local forecast quality.

For GridPulse, forecast uncertainty should depend on sensor location, geographic dispersion, data latency, and whether measurements represent the actual controlled portfolio.

## Physical-threat preparation

The system can combine environmental forecasts with historical vulnerability information. Examples include:

- wildfire exposure for a line or corridor;
- hurricane damage probability;
- earthquake exposure;
- storm-related communications loss;
- anticipated substation failure; and
- likely generation unavailability.

Potentially vulnerable components receive special constraints in the optimization. For example, predicted wildfire exposure can cause the system to reduce power flow on an at-risk line.

GridPulse can translate this into threat-conditioned envelopes such as:

```text
normal connection envelope
high-temperature transformer envelope
wildfire-risk envelope
loss-of-line envelope
central-communications-loss envelope
islanded survival envelope
```

These envelopes must be calculated from actual network studies; the patent supplies the architectural concept, not numerical limits.

## Cybersecurity and anomaly detection

The specification combines model-based and data-driven security techniques, including:

- power-flow models;
- grid state estimation;
- local outlier factors;
- one-class support vector machines;
- deep neural networks;
- streaming event detection;
- knowledge graphs;
- temporal association rules;
- SCADA and PMU data;
- weather information; and
- data from related communications and infrastructure systems.

Intended functions include:

- detecting anomalies;
- identifying missing or false measurements;
- estimating voltage phasors from incomplete observations;
- locating the affected grid area;
- estimating failed lines;
- detecting and classifying cyberattacks;
- determining probable root cause; and
- generating explainable relationships among events.

The important GridPulse lesson is that learned anomaly detection should operate alongside network physics. Suspicious telemetry should be tested against state estimation, power flow, redundant measurements, device acknowledgements, and neighboring signals.

## Delivery verification

A microgrid controller can evaluate whether its DERs followed commands. The PV example compares measured production after a curtailment command with an estimate of maximum available PV output derived from cameras or irradiance data.

GridPulse should verify:

- whether PV actually curtailed;
- whether a battery followed its real/reactive-power command;
- whether load shedding occurred;
- whether aggregate device delivery matches the PCC response; and
- how much resource capability remains after the event.

A dispatch instruction is not evidence of delivered flexibility.

## Autonomous black start and grid-forming control

The patent describes autonomous restoration using fleets of grid-forming inverters. The system can attempt to:

- energize a DER-dominated feeder without a centralized station;
- establish voltage and frequency;
- synchronize multiple inverters;
- share load;
- survive the loss of one or more inverters;
- restore critical loads progressively; and
- reconfigure controllers as communications return.

The specification discusses droop control, oscillator-based control, virtual oscillator control, and dispatchable oscillator-based control.

However, it does not provide complete controller equations, stability proofs, gains, protection coordination, energization sequences, or experimental results. GridPulse should treat this as an architecture and capability requirement, not a deployable black-start design.

## What the issued claims cover

The patent contains 11 claims. **Claim 1 is the only independent claim.**

At a high level, Claim 1 requires:

1. multiple microgrids, each containing generation and load;
2. one microgrid controller associated with each microgrid;
3. a first communication network;
4. a high-level controller coordinating normal operation;
5. a separate peer-to-peer network used when the high-level controller or primary network is unavailable; and
6. local third communication networks activated when peer-to-peer communication is disabled.

Dependent claims add:

- PV and storage in each microgrid;
- local state-of-health monitoring;
- an all-sky imager;
- short-term cloud-cover forecasting;
- estimation of PV generation;
- critical-load designation;
- priority delivery to critical loads;
- inverter output-voltage control;
- grid-forming synchronization and load sharing;
- an external weather database; and
- historical-data-based control.

The specification discusses distributed OPF, anomaly detection, knowledge graphs, black start, and threat mitigation more broadly than the independent claim. The core issued claim is principally focused on the three-level controller and communications-failover structure.

### Legal caution

This note is a technical research summary, not legal advice or a freedom-to-operate opinion. Current ownership, maintenance, enforceability, prosecution history, claim construction, jurisdiction, and later legal events require review by patent counsel.

## Direct lessons for GridPulse

### 1. Produce state-dependent capacity

GridPulse should calculate distinct capacity envelopes for:

- normal grid-connected operation;
- known equipment outages;
- N-1 conditions;
- severe-weather threats;
- vulnerable-corridor derating;
- loss of central control;
- peer-to-peer coordination;
- isolated microgrid operation; and
- restoration and black-start states.

### 2. Store resource capability vectors

Each DER record should include:

- real-power capability;
- reactive-power capability;
- remaining energy;
- estimated duration;
- response latency and ramp rate;
- grid-following capability;
- grid-forming capability;
- black-start capability;
- phase connection;
- communications status;
- state of health;
- critical-load commitments;
- export capability after internal requirements; and
- confidence in availability.

### 3. Reserve energy for resilience

A battery's full state of charge should not automatically be offered for data-center capacity activation. Energy may need to be reserved for:

- local critical loads;
- grid-forming support;
- black start;
- communications and control auxiliaries;
- contingency duration;
- restoration sequencing; and
- uncertainty in event duration.

### 4. Model controller and communications failures

Backtests should include:

- loss of cloud connectivity;
- loss of the central controller;
- loss of peer-to-peer communications;
- stale or corrupted telemetry;
- controller disagreement;
- isolated local operation; and
- staged restoration of communications.

### 5. Prioritize critical loads explicitly

For a data center, load classes can include:

- safety systems;
- network and security infrastructure;
- cooling minimums;
- storage and UPS auxiliaries;
- critical compute;
- deferrable compute; and
- noncritical offices and ancillary loads.

Each class should have a priority, minimum survival duration, interruptibility, restoration order, and rebound consequence.

### 6. Couple cyber and physical estimation

Do not accept suspicious telemetry as operational truth without checking:

- electrical-network consistency;
- neighboring measurements;
- historical behavior;
- redundant sensors;
- topology and communications status; and
- device acknowledgements.

### 7. Verify resource delivery

Independent device, microgrid, and PCC measurements should confirm actual response before GridPulse updates available capability or settlement records.

## What this patent does not provide

The patent does not calculate ordinary free connection capacity for a proposed data center. It lacks:

- a detailed AC capacity-assessment formulation;
- transformer thermal-aging calculations;
- comprehensive contingency screening;
- protection coordination and fault-level studies;
- interconnection-queue allocation;
- probabilistic connection-capacity certification;
- detailed battery efficiency and degradation models;
- data-center workload and cooling models;
- complete distributed-OPF equations;
- formal distributed-control convergence proofs;
- complete inverter protection and black-start sequences;
- quantitative deployment results; and
- demonstrated utility-scale validation.

The patent describes how a system can coordinate microgrids and preserve service through successive failures. It cannot establish that a proposed 50 MW or 100 MW connection has unused physical capacity.

## Recommended position in the GridPulse stack

```text
Capacity-discovery engine
  -> AC power flow, equipment limits, contingencies, protection,
     uncertainty, queue assumptions

Threat-conditioned envelope engine
  -> normal, N-1, weather threat, communications loss,
     islanding, and restoration states

Multi-horizon scheduler
  -> batteries, generators, flexible compute, cooling, and reserves

Three-level resilient controller
  -> central coordination
  -> peer-to-peer microgrid coordination
  -> autonomous local microgrid control

Verification and state-of-health layer
  -> confirm delivered response
  -> update surviving capability and restoration state
```

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

## Questions for implementation

1. Which physical, cyber, and communications states require distinct GridPulse capacity envelopes?
2. What minimum data and controls remain available at each failover layer?
3. Which data-center loads are critical, deferrable, or shed-capable?
4. How much battery energy must be reserved for islanding and restoration?
5. Which resources can form a grid rather than merely follow one?
6. How is microgrid export capability calculated after local critical-load obligations?
7. Which measurements independently verify DER delivery and state of health?
8. How are peer-to-peer optimization and controller stability validated under delay and partial communications?
9. What protection and synchronization approvals are required for islanding and reconnection?
10. Does the proposed controller architecture require patent counsel's freedom-to-operate review?

## Bottom line

US 11,025,089 expands GridPulse's capacity question from “How many additional megawatts can connect?” to:

> How many megawatts can connect and continue operating safely under each physical, cyber, communications, islanding, and restoration condition, and which critical loads remain supplied as the control architecture degrades?

Its three-level failover architecture, capability assessment, threat-conditioned redispatch, state-of-health monitoring, and delivery verification are valuable additions to the GridPulse methodology. The patent does not replace the separate network-capacity, protection, contingency, queue, and interconnection studies required to establish a connection offer.
