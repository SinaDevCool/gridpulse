# GridPulse product ownership register

This register applies to the production product only. The browser application never owns electrical feasibility, power-flow, contingency, or capacity calculations.

| Concern                                         | Canonical owner                                                              | Consumers                              | Rule                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| Product mode and capabilities                   | `src/config/product-mode.ts`                                                 | router, navigation, prerequisite views | Pages must not invent capability rules.                                  |
| Product destinations and workflow prerequisites | `src/components/product/product-navigation.ts`                               | product chrome, route tests            | One registry controls visibility and unavailable explanations.           |
| Application theme                               | `src/features/theme/ThemeProvider.tsx`                                       | shell, notifications, controls         | Basemap selection is a separate preference.                              |
| Basemap selection                               | `src/features/power-finder/basemap-config.ts`                                | shared map                             | It must not change application truth or evidence.                        |
| Map layer policy                                | `src/features/map/map-layer-registry.ts`                                     | Power Finder and Constraint Explorer   | The map and legend consume the same definitions.                         |
| Map source health and coverage                  | `src/features/map/map-source-registry.ts`                                    | shared map, legends and routes         | Independent transports reconcile once; routes do not infer availability. |
| National generation/storage tile projection     | `power_finder_public_registry_tile` Supabase function                        | shared map                             | Low zoom aggregates; investigable zooms use governed exact points.       |
| Site and project state                          | anonymous workspace and site portfolio repositories                          | all project experiences                | Maps render project state; they do not persist a second project.         |
| Evidence and claims                             | `src/features/grid-connection/evidence.ts` and shared grid-connection domain | explorer, enquiry, reports             | Only validated operator evidence can support a confirmed claim.          |
| Constraint-exposure presentation contract       | `src/features/constraint-exposure/contracts.ts`                              | API client, explorer, reports          | Unknown values remain `null`; the UI performs no power flow.             |
| Constraint-exposure retrieval                   | `src/features/constraint-exposure/client.ts`                                 | explorer route                         | Runtime validation fails closed on schema drift.                         |
| Mitigation comparison                           | `src/features/constraint-exposure/mitigations.ts`                            | explorer and enquiry                   | Compares supplied outcomes; does not create feasibility.                 |
| Operator-enquiry readiness                      | `src/features/operator-enquiry/readiness.ts`                                 | enquiry and reports                    | One pure policy owns readiness and missing inputs.                       |
| Analytics job transport                         | `src/lib/analytics-api.ts`                                                   | feature clients and reports            | Components do not call transport directly.                               |
| Decision package                                | existing reports/decision-package owners                                     | UI and exports                         | Views and exports use the same canonical projection.                     |

## Prohibited duplicates

- A second evidence or truth-class union.
- Page-local capability matrices.
- A separate Constraint Explorer map implementation.
- Browser-side PTDF, LODF, power-flow, thermal-limit, shadow-price, or capacity calculations.
- A second report calculation pipeline.
- A theme state inside individual pages.
- Exact-looking points for postcode, municipality, regional, or unknown locations.
