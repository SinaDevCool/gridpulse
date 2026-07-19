# GridPulse product-truth and repository-safety policy

## Product boundary

GridPulse provides customer-side screening, evidence management, scenario modelling and operator-engagement decision support. It is not a network study, connection offer, capacity reservation, grid-connection approval or control-room system.

Requested or modelled power must never be presented as available grid capacity. The responsible network operator remains controlling for the connection point, capacity, restrictions, reinforcement scope and energisation date.

## Evidence classes

- **Customer declared:** supplied by the project team and not independently verified.
- **Public source:** useful context, but not project-specific capacity evidence.
- **Derived:** a GridPulse calculation or screening result based on visible inputs, assumptions and limitations.
- **Operator confirmed:** current, written, project-specific evidence from the responsible network operator.

A capacity or connection-date claim may be shown as confirmed only when its evidence is operator-confirmed, validated and current. Customer inputs, public sources and GridPulse calculations must remain visibly distinguishable.

## Required language

Prefer `requested capacity`, `modelled connection envelope`, `screening candidate`, `indicative`, `operator review required`, and `operator confirmed`.

Do not use `capacity available`, `connection secured`, `power activated`, `energisation accelerated`, or `real-time operation` unless the project record contains the corresponding current operator evidence or live operational integration.

## Repository safety

- Keep `.env`, `.env.local`, `.env.development`, `.env.production`, `.dev.vars` and equivalent deployment files outside Git.
- Commit only `.env.example`, containing placeholders and no working credentials.
- Browser code may use publishable/anonymous client keys only. Service-role keys and deployment tokens must remain server-side secrets.
- Configure production values in the deployment platform and local values in ignored local files.
- Before publishing, inspect staged files and run the test, lint and production-build checks.

## Release check

1. Review new capacity, availability, connection-date, activation and real-time claims.
2. Confirm each material output shows its evidence class, validation status, assumptions and limitations.
3. Confirm no environment or secret file is staged.
4. Confirm reports preserve the product boundary and operator-control disclaimer.
5. Run `npm test`, `npm run lint:product` and `npm run build`.
