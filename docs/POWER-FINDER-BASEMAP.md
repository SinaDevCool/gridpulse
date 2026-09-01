# Power Finder basemap

## Provider and purpose

Power Finder uses the public OpenFreeMap vector basemap through MapLibre GL JS.
The basemap supplies geographic context such as roads, settlements, water and place
labels. It is not an electrical-network source and is not used in GridPulse capacity,
ranking, constraint or evidence calculations.

- Provider: OpenFreeMap
- Styles: Dark and Positron
- Underlying map data: OpenStreetMap
- Client: MapLibre GL JS
- Authentication: none
- Commercial use: permitted by the provider when reviewed on 29 August 2026
- Availability: public service supplied without an SLA

Provider references:

- https://openfreemap.org/
- https://openfreemap.org/quick_start/
- https://openfreemap.org/tos/
- https://www.openstreetmap.org/copyright

## Attribution

The MapLibre attribution control must remain visible. OpenFreeMap styles provide
the required OpenMapTiles and OpenStreetMap attribution. Product code must not
remove or obscure it.

## Failure boundary

Power Finder loads both public vector styles once and combines their layers so the
light/dark control does not replace the MapLibre style or remove GridPulse layers.
If the provider style cannot be loaded, the app uses a local neutral background.
Grid nodes, lines, sites, candidates and screening results remain usable and the
UI states that only the background map is unavailable.

## Provider independence

All provider URLs and fallback construction live in
`src/features/power-finder/basemap-config.ts`. Do not duplicate provider URLs in
components. A future Germany-only self-hosted VersaTiles or PMTiles source should
replace this configuration boundary rather than fork the Power Finder map.
