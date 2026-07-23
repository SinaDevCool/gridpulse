# Phase 2 Power Finder coverage

## Reuse decision

Phase 2 keeps the accepted PostGIS canonical tables, `power_finder_viewport` RPC, OSM normalizer,
MaStR release, candidate ranking, MapLibre component, evidence model, and shortlist workflow.
It does not create a second map database or a second candidate-scoring engine.

## Delivered capability

- Explicit Germany and Brandenburg navigation.
- Coverage status and evidence boundary per region.
- Voltage, evidence-authority, and published-capacity map modes.
- Voltage-aware line width and colour.
- National Geofabrik PBF source-manifest discovery and checksum tracking.
- Hourly source-health artifact for the advertised national extract.
- Database-backed coverage registry with authenticated access.

`DE-BB` is accepted. `DE` is partial/planned and may return an empty viewport outside the accepted
release. The UI says this directly. Planned coverage never causes the Brandenburg artifact to be
drawn in another region.

## National batch runbook

The source manifest is intentionally not an ingestion:

```powershell
$env:PYTHONPATH = (Resolve-Path "services/grid-data/src").Path
python -m grid_data.cli check-geofabrik `
  --output D:\grid-data\geofabrik-germany-source.json
python -m grid_data.cli download `
  --url https://download.geofabrik.de/europe/germany-latest.osm.pbf `
  --output D:\grid-data\germany-latest.osm.pbf
```

Before national promotion:

1. Verify the downloaded MD5 against the Geofabrik checksum and calculate SHA-256.
2. Preserve the raw PBF in immutable object storage.
3. Parse nodes, lines, cables, substations, and industrial land with a streaming PBF parser.
4. Normalize voltage arrays, operators, names, lifecycle states, and geometries.
5. Reject invalid geometries and quarantine records with unsupported coordinate systems.
6. Resolve canonical identities against the accepted regional release.
7. Stage into a non-active release and reconcile source/accepted/rejected counts.
8. Test bounded viewport performance at national and urban scales.
9. Review ODbL attribution and downstream-share obligations.
10. Promote atomically, then change Germany coverage from `partial` to `accepted`.

R2 or another immutable artifact store is required before downloading the national extract in
production. A live URL and checksum manifest are not a substitute for an accepted dataset release.

## Capacity boundary

The capacity map mode does not estimate German demand headroom. It colours only classified public
capacity observations. Grey means not established. MaStR MW remains registered asset context.

## Acceptance checks

- Deep-linked region and map mode survive navigation.
- Germany view never displays the Brandenburg fallback as national coverage.
- Every feature retains evidence classification.
- Unknown capacity remains visibly unknown.
- The source manifest is emitted as `accepted=false`.
- Existing candidate-to-assessment workflow remains unchanged.
