const interactionDisposers = new WeakMap<object, () => void>();
import type { Subscription, MapLayerMouseEvent, Map as MapLibreMap } from "maplibre-gl";
import {
  isGeoJsonSource,
  publishVisibleLayerCounts,
  renderedFeatureToPowerFinderFeature,
} from "./feature-selection";
import { applyOverlayTheme, sourceIds } from "./layer-style";
import type { MapResources } from "./resource-contract";
export function registerInteractions(
  map: MapLibreMap,
  resources: Pick<
    MapResources,
    | "mapRef"
    | "onSelectRef"
    | "onViewportChangeRef"
    | "collectionRef"
    | "onSitePlacementRef"
    | "onVisibleLayerCountsRef"
    | "basemapModeRef"
  >,
  isCancelled: () => boolean,
) {
  interactionDisposers.get(map)?.();
  const subscriptions: Subscription[] = [];

  const {
    mapRef,
    onSelectRef,
    onViewportChangeRef,
    collectionRef,
    onSitePlacementRef,
    onVisibleLayerCountsRef,
    basemapModeRef,
  } = resources;
  for (const layer of [
    "rzreg-data-centre-clusters",
    "rzreg-data-centre-cluster-count",
    "rzreg-data-centres-approximate-area",
    "rzreg-data-centres-approximate",
    "rzreg-data-centres-exact",
  ]) {
    map.moveLayer(layer);
  }
  applyOverlayTheme(map, basemapModeRef.current);
  const selectFeature = (event: MapLayerMouseEvent) => {
    if (isCancelled() || mapRef.current !== map) return;
    const rendered = event.features?.[0];
    if (!rendered) return;
    const id = rendered?.id ?? rendered?.properties?.id;
    const feature =
      collectionRef.current.features.find((item) => String(item.id) === String(id)) ??
      renderedFeatureToPowerFinderFeature(rendered);
    if (feature) onSelectRef.current(feature);
  };
  for (const layer of [
    "grid-nodes",
    "industrial-sites",
    "grid-lines",
    "generation-assets",
    "storage-assets",
    "national-grid-nodes",
    "national-industrial-sites",
    "national-industrial-overview",
    "national-generation-overview",
    "national-generation-assets",
    "national-storage-assets",
  ]) {
    subscriptions.push(map.on("click", layer, selectFeature));
    subscriptions.push(
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      }),
    );
    subscriptions.push(
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      }),
    );
  }
  const registerClusterExpansion = (layer: string, sourceId: string) => {
    subscriptions.push(
      map.on("click", layer, (event) => {
        const cluster = event.features?.[0];
        const clusterId = cluster?.properties?.cluster_id;
        if (!cluster || typeof clusterId !== "number" || cluster.geometry.type !== "Point") return;
        const coordinates = cluster.geometry.coordinates as [number, number];
        const source = map.getSource(sourceId);
        if (!isGeoJsonSource(source)) return;
        void source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            if (!isCancelled() && mapRef.current === map)
              map.easeTo({ center: coordinates, zoom, duration: 450 });
          })
          .catch(() => {
            /* A removed/replaced source cannot be expanded. */
          });
      }),
    );
    subscriptions.push(
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      }),
    );
    subscriptions.push(
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      }),
    );
  };
  registerClusterExpansion("node-clusters", sourceIds.node);
  registerClusterExpansion("generation-clusters", sourceIds.generation_asset);
  registerClusterExpansion("storage-clusters", sourceIds.storage_asset);
  registerClusterExpansion("rzreg-data-centre-clusters", "rzreg-data-centres");
  subscriptions.push(
    map.on("click", (event) => {
      if (!onSitePlacementRef.current) return;
      const interactive = map.queryRenderedFeatures(event.point, {
        layers: [
          "grid-nodes",
          "industrial-sites",
          "grid-lines",
          "generation-assets",
          "storage-assets",
          "node-clusters",
          "generation-clusters",
          "storage-clusters",
          "national-grid-nodes",
          "national-industrial-sites",
          "national-industrial-overview",
          "national-generation-overview",
          "national-generation-assets",
          "national-storage-assets",
          "rzreg-data-centre-clusters",
          "rzreg-data-centres-approximate-area",
          "rzreg-data-centres-exact",
          "rzreg-data-centres-approximate",
        ],
      });
      if (!interactive.length) {
        onSitePlacementRef.current([event.lngLat.lng, event.lngLat.lat]);
      }
    }),
  );
  map.moveLayer("finder-project-site");
  map.moveLayer("selected-candidate-halo");
  map.moveLayer("selected-candidate-core");
  map.moveLayer("selected-candidate-label");
  subscriptions.push(
    map.on("moveend", () => {
      const bounds = map.getBounds();
      onViewportChangeRef.current?.({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      });
      publishVisibleLayerCounts(map, onVisibleLayerCountsRef.current);
    }),
  );
  subscriptions.push(
    map.on("idle", () => publishVisibleLayerCounts(map, onVisibleLayerCountsRef.current)),
  );

  const dispose = () => {
    for (const subscription of subscriptions) subscription.unsubscribe();
    subscriptions.length = 0;
  };
  interactionDisposers.set(map, dispose);
  return dispose;
}
