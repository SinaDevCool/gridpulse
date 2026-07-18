# GridPulse 2.0

GridPulse is being repositioned as an evidence-led grid connection screening workspace for German BESS and large-load projects.

## Product rules

- Never present estimated grid headroom, connection dates, costs, or revenue as measured facts.
- Classify each output as official source, customer input, assumption, calculation, or operator validation required.
- A pre-feasibility report remains gated until required operator evidence is supplied.
- GridPulse supports early decisions; it does not replace a Netzanschlussbegehren, network study, or connection offer.

## Local development

1. Copy `.env.example` to `.env.local` and add credentials from a Supabase project you control.
2. Run `npm install`.
3. Run `npm run dev`.
4. Apply `supabase/migrations/20260718000000_grid_connection_assessments.sql` through the Supabase CLI or SQL editor before enabling persistence.

The active product routes are `/`, `/portfolio`, `/assessments/new`, `/evidence`, `/reports`, and `/data-sources`. Legacy news/data routes remain in the repository temporarily for data-connector extraction, but are no longer linked from the product navigation.

## Pilot workflow

1. Create a German BESS, large-load, or co-location assessment.
2. Review the coordinate-based transmission-area screening and confirm the responsible DSO independently.
3. Add official, customer, and operator evidence to the ledger.
4. Upload a CSV with `timestamp`, `import_mw`, and `export_mw` at consistent 15, 30, or 60-minute resolution.
5. Compare unrestricted, static FCA, and weekday time-window FCA cases.
6. Record the energy-value assumption and review constrained MWh, restricted hours, and indicative gross impact.
7. Print the gated report only after operator evidence has been validated.

Apply both migrations in `supabase/migrations` before using interval profiles. The operator screening is preliminary transmission-area context, not authoritative DSO identification or evidence of connection capacity.

## Independent deployment

The application targets Cloudflare Workers using the official Vite adapter. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets. After this branch is reviewed and merged into `main`, every push to `main` builds and deploys without Lovable. Attach `gridpulseinsights.com` to the resulting Worker in Cloudflare only after validating the preview URL.
