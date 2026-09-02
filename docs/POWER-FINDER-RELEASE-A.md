# Power Finder Release A — synthetic capacity-scenario demo

Release A adds requirement-sensitive geographic and temporal screening to the public Power Finder.
It does **not** reproduce GridCARE's proprietary model and it does not establish free, available,
connectable, reserved, or operator-confirmed capacity.

## Evidence classes

- `observed_public`: accepted mapped infrastructure and MaStR asset context.
- `synthetic`: replaceable equipment ratings and operating limits generated deterministically.
- `model_derived`: calculations derived from observed and synthetic inputs.
- `operator_confirmed`: reserved for future reviewed operator evidence; Release A produces none.

## Versions

- Scenario: `de-bb-synthetic-capacity-v1`
- Hourly model: `deterministic-hourly-profile-v1`
- Ranking: `release-a-requirement-ranking-v1`

The machine-readable methodology is published at
`/power-finder/release-a-synthetic-methodology.json`.

## Calculation boundary

For every candidate, Release A derives synthetic transformer, upstream-branch,
voltage-security and contingency limits from mapped voltage plus a stable candidate identifier.
The minimum becomes the synthetic firm envelope. A deterministic 8,760-hour operating profile
produces a conditional envelope and P10/P50/P90 scenario distribution.

Customer flexibility, batteries and on-site generation are simulated against that envelope. They
may reduce residual constrained hours but do not increase the underlying firm network envelope.

## Ranking

The ranking is fully deterministic and explainable:

- 25% synthetic capacity fit
- 15% voltage and project-scale fit
- 15% temporal availability
- 10% distance
- 10% public evidence quality
- 10% synthetic operating stress
- 10% customer flexibility burden
- 5% mapped site context

## Replacement path

The scenario response includes `replacementTarget`. The synthetic limits must eventually be
replaced with DSO/TSO asset ratings, planning topology, operational loading, security criteria and
connection-queue information. The API and UI contracts retain evidence status and model version so
real operator data can replace synthetic inputs without changing the customer workflow.

## Security and privacy

The public calculation endpoint accepts at most 25 bounded candidates, limits request bodies,
shares the Finder edge rate limiter, stores no customer project, and returns `Cache-Control:
no-store`. Local project persistence remains on the user's device.
