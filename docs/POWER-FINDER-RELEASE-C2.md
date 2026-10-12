# Power Finder Release C2 — German hourly capacity context

Release C2 combines real German system/weather observations with the Release C1 AC solver. It
creates versioned hourly operating cases and P10/P50/P90 capacity envelopes. The public benchmark
remains a `synthetic_demonstration`: it is not capacity at any mapped node.

## Free sources and their proper roles

| Source | C2 use | Licence/reuse | What it cannot establish |
|---|---|---|---|
| Bundesnetzagentur SMARD | German hourly grid-load scaling | CC BY 4.0; attribution `Bundesnetzagentur \| SMARD.de` | Feeder/substation loading or headroom |
| DWD Climate Data Center | Hourly Berlin-Tempelhof temperature and weather-year variation | DWD open-data terms | Electrical constraints or capacity |
| MaStR | Registered generation/storage technology aggregates | Public MaStR data terms | Actual dispatch or available capacity |
| SimBench | Representative German network and renewable profiles | ODbL 1.0 | A real geographic network location |

Operator SCADA, accepted connections, switching plans and reviewed network models remain required
for a location result.

## Implemented pipeline

1. Download versioned SMARD hourly grid load and DWD hourly temperature.
2. Parse and hash every source artifact and preserve publisher, URL, licence and evidence boundary.
3. Require complete 8,760/8,784-hour years. Missing data may be interpolated only below 0.5%,
   with internal gaps limited to 48 hours and every imputed hour recorded.
4. Build 2023, 2024 and 2025 operating cases and apply an explicit target-year growth assumption.
5. Scale existing demand and representative renewable generation in the electrical model.
6. Run AC binary-search capacity for every distinct operating state and map results to every hour.
7. Report P10/P50/P90, minimum/maximum, constrained hours, maximum curtailment, curtailed MWh and
   binding-constraint frequency.
8. Persist source releases, the full hourly result and summary in Supabase.
9. Expose summary-only data through a field-limited public RPC. A real node envelope is returned
   only for a reviewed model link and `operator_reviewed` or `operator_confirmed` result.

## Commands

```powershell
npm run grid:validate:c2
npm run grid:publish:c2
```

The checked-in artifact uses 26,304 hourly cases across 2023–2025. Its numeric envelope belongs
only to the SimBench connection bus and the stated benchmark assumptions.

## Current limitations

- C2 is steady-state AC analysis, not short-circuit, protection or dynamic stability analysis.
- The benchmark has no reviewed operator contingency list or planned switching/outage schedule.
- SMARD is national/system context; regional allocation requires an explicit reviewed method.
- MaStR assets are context only and are not automatically converted into hourly dispatch.
- A target-year demand-growth rate is a disclosed scenario input, not an operator forecast.

## References

- SMARD data use: https://www.smard.de/en/datennutzung
- SMARD download guidance: https://www.smard.de/en/all-about-our-data-download-section-210130
- DWD CDC open data: https://opendata.dwd.de/climate_environment/CDC/
- MaStR download: https://www.marktstammdatenregister.de/MaStR/Datendownload
- SimBench datasets: https://simbench.de/en/download/datasets/
