# Inframation public interface and Germany transfer audit

Audit date: 21 November 2026. This follow-up began only after the initial GridPulse
implementation and validation were complete. Findings describe a live, changing website;
record counts are observations, not durable coverage promises.

## Decision

Use the evidence design: linked records, field-level sources, dated releases, explicit gaps,
shareable filters, readable methodology and a progression from discovery to human review.
Do not interpret historical generation, idle status, nearby lines or queue MW as available
import capacity. Do not ingest the whole Inframation API into a commercial product on the
assumption that public access supplies redistribution rights.

The largest practical opportunity for GridPulse is an evidence-led German connection
investigation workflow. A broad global infrastructure directory would dilute that purpose.
Retain the existing analytical service as the owner of physical models and optimisation.

## Scope and limits of the walkthrough

The supplied [Ontario map](https://inframation.io/?sheet=half&use_lt=0.4&center=-81.7481%2C44.2511&zoom=9.75)
was the starting point. The review used the public browser interface, desktop and a
390 × 844 viewport, and representative asset, project, company, connection-point,
opportunity and corridor records. All **81 dataset licence/publication disclosures** were
expanded and read. This is broad public workflow coverage, not a claim that every record
or every combination of filters was inspected.

No account was created, reset email requested, alert subscribed, form sent, report filed,
meeting booked, purchase made or private workspace accessed. Authentication, alert delivery,
paid deliverables and private collaboration are therefore unverified. No load test,
penetration test, source-code review of Inframation, measured Core Web Vitals audit or
formal accessibility conformance assessment was performed.

| Surface | Interaction and verified result | Limits / lesson |
| --- | --- | --- |
| Map | Opened Power and gas subtypes; applied combined-cycle filter and observed `type=gas&tech=gas_cc`; selected data centres and observed `type=load`; applied Loudoun source and observed 79 matches; opened size, date, owner, source and underused controls | Not every individual company, date or technology option was applied |
| Map state | Tested stage selection, clear/reset, underused modes, list height/close controls, name sorting and layer/key panels | Sorting changes URL; list/map request timing needs clear loading states |
| Layers | Inspected Auto/Map/Satellite choices, infrastructure, price and fibre overlays, fuel/underused paint, key and source credits | Overlay presence is not an engineering finding |
| Responsive UI | Opened mobile navigation, mobile list sorting and site-finder criteria; Show results closed the mobile criteria panel | One viewport, not a full device/browser matrix |
| Assets | Inspected capacity/generation/CF tooltips, catalogue filter form; searched Bruce and verified seven matches; followed representative records and sources | Next-page action attempted, but final pagination state was not independently established before subsequent search |
| Asset operations | Grand Coulee chart 5Y/10Y/All/Yearly controls and operations methodology; Palo Verde output; Bruce unit/source attributes | Chart controls are view modes; do not mix annual and rolling figures |
| Projects | Opened status filters, applied storage and 100–500 MW; inspected Nye Nore project, dates, source and organisation relationships | Active status is source-specific; not a delivery forecast |
| Companies | Searched Statkraft; switched group/self scope and observed different counts; inspected ownership fractions and deduplication explanation | Not every tab/relationship expanded recursively |
| Site finder | Changed voltage, line/substation distance, acreage, owner count and exclusion toggles; selected Louisiana then Calcasieu; sorted by substation distance; opened a corridor and supporting layers | No parcel survey, rights verification or site acquisition assessment |
| Prices | Expanded metrics and time-window methodology, inspected hubs/currencies; attempted market/kind filtering | Final filtered market result not independently verified; no trading or dispatch simulation |
| Opportunities | Opened a German TED record, dates, currency conversion, source and correction form | No correction submitted; procurement is separate from connection availability |
| Connection points | Opened queue methodology, Alverdiscott record and NESO source | A queue connection point can be unlocated; no invented coordinates |
| Evidence pages | Methodology, gaps, status words, glossary, sources, datasets, attribution and reuse; expanded main explanations and licence disclosures | Site-declared rights and completeness are not independent legal findings |
| Public API | API docs, browser-rendered draft OpenAPI and documented `/v1/coverage`; inspected bounded summaries of visible JSON | No private/admin endpoints or bulk harvest; response schema remains draft |
| Commercial pages | About value-chain controls, all five audience pages, four service/deal-room tabs, four site-check offer choices and `/build` redirect | Prices and marketing claims observed, not a service-quality assessment |
| Forms / policies | Login, register, forgot password, alerts gate, submit, correction, contact, privacy request, unsubscribe, privacy and crawler policy | Read-only inspection; no final submit/account or private-data entry |

## How “underused” is calculated

### What is established

The map explains utilisation as net generation divided by capacity times hours, using
EIA-923 production for covered US plants. Absolute choices include below 10%, 20% and
40%, plus missing-output and technology-relative modes. The exact supplied URL requests
the absolute below-40% filter; it does not itself establish spare capacity at the Ontario
coordinates.

The [asset catalogue](https://inframation.io/assets) describes a rolling 12-month statistic.
At review its window ended in August 2026. Generation is withheld where required months
are absent; missing production is not filled with zero. Its CF explanation uses nameplate
MW and suppresses implausible values above one.

For a constant capacity:

`capacity factor = net generation MWh / (nameplate MW × elapsed window hours)`

For the German offline calculation implemented in this branch:

`capacity factor = sum(net generation MWh_i) / sum(matched net AC MW_i × elapsed hours_i)`

The second denominator accommodates capacity changes and actual interval lengths. Gross,
net, DC, AC, unit and station boundaries must match; the two implementations should not
be expected to produce identical values without reconciling these choices.

### Annual versus rolling example

[Grand Coulee](https://inframation.io/assets/grand-coulee-us-wa) showed 6,809 MW and
2025 net generation of 16,151,147 MWh. Its annual operations table gave 27.1% CF:

`16,151,147 / (6,809 × 8,760) ≈ 0.2708`

The catalogue's later rolling window showed 18,992.5 GWh and about 31.8%. Those figures
have different windows, so the difference is not evidence of a calculation defect.
The annual methodology explicitly uses the **current** nameplate against historical years,
including 8,784 hours for leap years. Uprating, retirement and commissioning can bias that
historical comparison. Partial 2026, eight months at review, had no annual CF.

The headline describes the plant as having “ran 27% of 2025”. That wording can be read as
operating hours, although the calculation is an energy ratio. GridPulse should say
historical capacity factor and state the window. It should not translate CF into time
online or efficiency. A hydro record also displayed a 2025 “Fuel burned” MMBtu figure;
that label is insufficient evidence of physical fuel combustion. Preserve source accounting
definitions before displaying cross-technology energy-input metrics.

### Technology-relative mode is not a spare-capacity detector

The [data-centre audience page](https://inframation.io/for/data-center-developers) links to
`use=low_for_kind&stage=operating` and highlights large examples. One was
[Palo Verde](https://inframation.io/assets/palo-verde-us-az), whose detail page showed
4,209.6 MW, 31,321,808 MWh for 2025 and about **85%** annual CF. Its rolling map figure
was about 84%. A relatively low peer result can still represent intensive production.

The public explanations inspected did **not** establish an exact, versioned peer-cohort
definition, percentile cutoff, sample-size policy, age adjustment or tie rule for
`low_for_kind`. Do not invent one or reproduce the filter as if its algorithm were known.

Neither `1 − CF` nor `(1 − CF) × MW` measures free grid MW. Such a value ignores
simultaneous demand, network direction, contingencies, protection, bays, reinforcement,
connection agreements and dispatch constraints. Plant retirement likewise does not transfer
connection rights to a prospective data centre.

### The Ontario result

The original filtered view returned zero matches during the walkthrough. Bruce's separate
[asset record](https://inframation.io/assets/bruce-nuclear-power-plant-ca) was present,
operating at 6,944 MW, with no comparable generation metric. A Canadian record without
output must not qualify as below 40%. Its GEM source identified a September 2026 release
retrieved in October, and described record-specific removal of TransitionZero-sourced rows.

At another point the root map initially returned zero counts and later populated after
normal navigation/reload, while server-rendered catalogue pages remained available. The
cause was not established. Consequently neither transient zeros nor the Ontario filtered
empty state prove absence of infrastructure. GridPulse needs to distinguish loading,
unavailable retrieval, uncovered geography and genuine zero matches.

## Site-finder geometry: useful discovery, bounded evidence

The [site finder](https://inframation.io/site-finder) starts with OSM lines of at least
69 kV, a one-mile corridor, substations within five miles and effective flood-map screening.
The displayed method splits lines into roughly half-mile pieces, screens pieces, joins
adjacent passes and clips mapped flood areas out of the displayed corridor. Its flood
eligibility allows up to 90% of the original band to intersect flood zones before clipping;
“out of the floodplain” therefore describes displayed geometry, not an untouched parcel.

At default review: 9,130 bands, 11,991.9 line-miles, computed 13 November. Another 34,369.5
miles satisfying other criteria lacked flood coverage and were excluded while that filter
was on. Map rendering explicitly capped at 2,000 bands; the list and counts have a wider
scope. This disclosure is a useful model for GridPulse's retrieval limits.

Changing controls, then choosing Louisiana and Calcasieu, produced two bands around
5.5 miles total at that observation. An Entergy Louisiana 500 kV corridor exposed nearby
substation distance, clipped flood share, effective FEMA panel, county context and external
map/source links. The close control retained filters and sort.

Texas parcel holdings group same-owner parcels that touch or are separated by roughly
100 feet. This is a prospecting definition, not a title opinion or survey. County fibre
availability is not fibre routes; WRI basin stress is not water permission. Protected-area,
seismic, sedimentary and incentive overlays support questions, not engineering acceptance.

German adaptation must use metric units, relevant 110/220/380 kV context, official Länder
hazard scenarios and licensed cadastral/planning evidence. No national parcel ownership,
usable-area or flood clearance should be inferred from a line buffer or missing overlay.

## Source, identity and API audit

### Strengths worth transferring

- Fields and records link to their original sources; original attributes remain inspectable.
- Release date, source as-of date, retrieval date and first observation are explained separately.
- Queue withdrawals, unknown status, unlocated records and missing parent ownership are visible.
- Company group scope is distinct from own-record scope. Weighted ownership is distinct from
  physical capacity and group capacity is deduplicated.
- Status mapping is documented: a source's broad active label can be refined by another field;
  a permit does not mean all permits, and built does not necessarily mean operating.
- Measured coverage and explicit withholding give users a way to assess empty results.
- Public correction and project submission workflows disclose editorial review and default
  privacy. GridPulse can begin with a copyable evidence receipt without creating a new inbox.

### Caveats and findings

| Priority | Observation | Consequence for GridPulse |
| --- | --- | --- |
| High | Underused and runtime language can invite capacity inference; high-CF nuclear appears in relative examples | Keep generation statistics outside import-capacity ranking and use precise metric names |
| High | Licence classes differ across 81 datasets, including noncommercial restrictions; derived-only is not equivalent to unrestricted | Admit each source, transformation and export scope separately |
| High | Historical denominator uses today's nameplate | Preserve time-varying capacity histories and matched measurement basis |
| Medium | 43 of 53 flowing sources lacked a stated release date in measured coverage | Retrieval dates cannot earn source-recency credit |
| Medium | Dated editorial gap notes and live catalogue scope differed; static reuse withholding counts differed from measured coverage | Date prose and render current counts from governed coverage, with scope labels |
| Medium | Hydro reservoirs could appear under generic Storage, with a map action described as Batteries | Preserve technology and electrical role; do not imply electrochemical storage |
| Medium | Public coverage JSON contained jurisdiction strings such as US-ON / US-MB / US-MX / US-NA | Investigate normalisation and quarantine ambiguous matches before German publication; this is not proof every affected record is wrong |
| Medium | Some attribution links used local `file:///data/vendored...` paths | Supply externally usable provenance or explicitly mark unavailable source documents |
| Medium | Direct scripted OpenAPI retrieval encountered a Cloudflare challenge; ordinary browser navigation worked | Public API availability and ingestion operation require agreement and monitoring, not challenge bypass |
| Medium | Draft OpenAPI used broad object responses and limited typed filter detail | Version contracts, validate responses and fail closed; no blind production dependency |
| Low / needs validation | Some expanded credits controls had unclear accessible labels during inspection | Test named controls, focus, keyboard operation and mobile results before copying the pattern |

The [coverage endpoint](https://api.inframation.io/v1/coverage) reported 250 registered
sources, 53 with rows and 59 withheld sources. Its total asset-row count differed from
the catalogue's located-asset count. This is a scope distinction, not automatically a
defect. The [methodology](https://inframation.io/methodology),
[gaps](https://inframation.io/gaps) and [reuse summary](https://inframation.io/about/sources/reuse)
must be read alongside measured values and each source's own terms.

The [API documentation](https://inframation.io/docs/api) describes shared public rate
limits and a draft API, with keys not yet issued. The visible OpenAPI was version
1.0.0-draft. Free feeds do not supply a commercial blanket licence or service commitment.
Record-specific GEM filtering does not clear noncommercial inputs elsewhere in the product.
ODbL and attribution obligations must survive transformations and export where applicable.
The reuse page itself is a summary, not a customer API contract.

## Other product lessons

Prices separate market, currency, interval cadence, window and missingness. The explanation
suppresses statistics below 90% interval coverage, uses unweighted means and describes a
top-four minus bottom-four hourly spread as a rough pre-loss ceiling. This is a useful
example of honest metric boundaries. It is not a German battery revenue model; bidding-zone
prices cannot establish local substation congestion. Do not copy US price sources or
negative-price causal claims into German network qualification.

The German TED opportunity inspected preserved original EUR value, converted USD value,
ECB rate date, publication, deadline and first observation. Preserve original units/currency
and date roles if GridPulse later introduces procurement intelligence. It is separate from
siting and is not required for the current Finder workflow.

Services, audience pages and the interactive value chain explain different customer jobs.
The useful progression is discover → inspect evidence → identify gaps → request scoped
human review. US paid-check pricing and private deal-room features are not validated
German demand. Accounts, alerts, ownership graphs and tender aggregation should wait for
a demonstrated workflow need, access basis and operational owner.

## Germany source decisions, verified against primary material

| Source | Useful scope | Admission / claim boundary |
| --- | --- | --- |
| [50Hertz connection perspective](https://www.50hertz.com/Vertragspartner/Netzkunden/Netzanschluss) | Indicative connection and bay context | Page identifies a 31 March 2026 assessment; nonbinding maxima depend on applicant mix/location. Four-TSO maturity process introduced April 2026. Confirm current project process and data-use permission; no automatic offer or reservation |
| [SMARD plant data](https://www.smard.de/en/downloadcenter/download-power-plant-data) | Generation time series for covered units of at least 100 MW | Not comprehensive small-unit coverage. Match unit/boundary/capacity history; preserve attribution and revisions |
| [SMARD data use](https://www.smard.de/home/datennutzung) | Published reuse terms | CC BY 4.0 with attribution; wholesale-price licensing has a separate stated review. Do not generalise one dataset's permission to every market feed |
| [MaStR](https://www.marktstammdatenregister.de/MaStRHilfe/subpages/glossar.html) | Asset identity and registered capacity | Registration is not actual generation, spare import, ownership clearance or a connection right |
| [BNetzA FCA explanation](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Netzanschluss/FAQ_FCA/FCA_table.html?nn=695692) | Connection restrictions as questions for operator review | Static/dynamic and temporary/permanent arrangements vary; the page does not establish an unconditional obligation to offer an FCA |
| [Official flood datasets](https://www.govdata.de/suche/daten/hochwassergefahrenkarten-und-hochwasserrisikokarten-umweltatlas) | Scenario-specific hazard screening | Resolve the actual Länder dataset, date, licence and coverage; missing data remains unassessed |
| [Broadband atlas](https://www.bundesnetzagentur.de/GIGA/DE/Breitbandatlas/start.html) | Coverage context | Does not prove two independent carrier routes, site delivery or access to restricted infrastructure records |
| [EnEfG §11](https://www.gesetze-im-internet.de/enefg/__11.html) | Efficiency / heat-reuse review | Apply commissioning-date rules, timing, conditions and exceptions; nearby heat networks are not binding offtake |

These are investigation references, not a declaration that those datasets have been newly
integrated or cleared for publication. No Inframation dataset was imported into GridPulse.

## Implementation disposition

The initial GridPulse phases already corrected ranking, source recency, coverage, bounded
retrieval, synthetic URL access, optional-study failures and German evidence qualification.
The follow-up adds a portable screening evidence receipt and a public metric glossary.
The detailed dependency-ordered plan and acceptance gates are in
[GERMANY-FINDER-LEARNINGS-PLAN.md](GERMANY-FINDER-LEARNINGS-PLAN.md).

Do not release a Germany-wide underused filter, claimed spare-MW layer, parcel score or
operator-confirmed badge until the corresponding admission and prospective validation gates
are met. Honest unknowns are the complete local implementation of those boundaries, not
substitutes for missing source data or operator outcomes.
