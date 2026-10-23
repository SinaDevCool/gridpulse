# Synthetic property portfolio

`synthetic-property-portfolio.xlsx` contains ten fictional demonstration opportunities,
explicitly labelled synthetic in each row. It contains no represented client properties.
Keep it versioned: browser import regression tests must run on a clean CI checkout.

Finder browser helpers in `tests/finder-e2e/finder-test-data.ts` isolate workflow
checks from live enrichment and viewport availability. Brandenburg uses the existing
accepted public artifact; operator geometry and enrichment responses are explicitly
synthetic and never enter production assets. Real map/RPC availability and operator
records remain covered separately by `scripts/check-production-map.mjs` after deployment.
