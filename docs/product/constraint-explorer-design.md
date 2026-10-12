# Constraint Explorer product design

Constraint Explorer answers which observed or modelled bottlenecks may affect a proposed German site, which scenarios expose them, which mitigations may help, and what still requires operator confirmation.

It does not establish connection capacity. The product consumes a canonical analytical result and preserves its evidence class, limitations, source references, timestamps, schema version, and fingerprint.

## Evidence states

- `public_source`: observed contextual evidence.
- `customer_declared`: an input awaiting independent validation.
- `modelled`: an analytical result and nonclaim.
- `operator_confirmed`: supported by current, validated operator evidence.
- `unknown`: unavailable or insufficiently supported.

## Experience

The shared map is configured with a constraint layer policy. Filters and selections are represented in the URL. The ranked list is the accessible non-map equivalent. A detail drawer exposes severity, recurrence, sensitivity, evidence, precision, limitations, sources, and required next action. Mitigation cards compare supplied canonical outcomes without recomputing feasibility.

## Rendering integrity

- Constraint severity, voltage class, evidence class, and location precision are separate visual channels.
- Postcode and regional records are rendered as aggregates or areas, never exact-looking points.
- Unknown numerical values display as unknown, never zero.
- Model-implied values are never labelled as German market shadow prices.
- Public and synthetic information remain nonclaims.
