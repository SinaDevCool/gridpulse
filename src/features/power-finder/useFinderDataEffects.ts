import { loadPowerFinderCoverage } from "@/features/power-finder/coverage";
import { loadPowerFinderViewport } from "@/features/power-finder/data-source";
import { loadGridOperatorCatalog } from "@/features/power-finder/operator-catalog";
import { useEffect } from "react";
import type { FinderControllerContract } from "./controller-contract";
type Context = Pick<
  FinderControllerContract,
  | "collection"
  | "setCollection"
  | "project"
  | "setError"
  | "bounds"
  | "setDataMode"
  | "maxDistanceKm"
  | "setRanking"
  | "setRankingCollection"
  | "setRankingState"
  | "setCoverage"
  | "setOperatorCatalog"
  | "setOperatorCatalogState"
  | "regionCode"
>;
export function useFinderDataEffects(context: Context) {
  const {
    collection,
    setCollection,
    project,
    setError,
    bounds,
    setDataMode,
    maxDistanceKm,
    setRanking,
    setRankingCollection,
    setRankingState,
    setCoverage,
    setOperatorCatalog,
    setOperatorCatalogState,
    regionCode,
  } = context;
  useEffect(() => {
    void loadGridOperatorCatalog()
      .then((catalog) => {
        setOperatorCatalog(catalog);
        setOperatorCatalogState(catalog.length ? "ready" : "unavailable");
      })
      .catch(() => {
        setOperatorCatalog([]);
        setOperatorCatalogState("unavailable");
      });
  }, [setOperatorCatalog, setOperatorCatalogState]);
  useEffect(() => {
    let active = true;
    void loadPowerFinderCoverage().then((result) => {
      if (active) setCoverage(result);
    });
    return () => {
      active = false;
    };
  }, [setCoverage]);
  useEffect(() => {
    if ((bounds.east - bounds.west) * (bounds.north - bounds.south) > 6) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadPowerFinderViewport(bounds, controller.signal, {
        fallbackAllowed: true,
        // Registry context is delivered by the independent vector-tile source.
        // Keep viewport GeoJSON focused on candidate geometry and evidence.
        includeRegistryAssets: false,
      })
        .then(({ collection: nextCollection, mode }) => {
          setCollection(nextCollection);
          setDataMode(mode);
          setError("");
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setError(
              reason instanceof Error ? reason.message : "Power Finder data failed to load.",
            );
          }
        });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [bounds, regionCode, setCollection, setDataMode, setError]);
  useEffect(() => {
    setRankingCollection(null);
    if (project.latitude == null || project.longitude == null) {
      setRanking(null);
      setRankingState("ready");
      return;
    }
    const controller = new AbortController();
    const latitudeRadius = Math.max(0.08, maxDistanceKm / 111);
    const longitudeRadius = Math.max(
      0.08,
      maxDistanceKm / (111 * Math.max(0.3, Math.cos((project.latitude * Math.PI) / 180))),
    );
    void loadPowerFinderViewport(
      {
        west: project.longitude - longitudeRadius,
        south: project.latitude - latitudeRadius,
        east: project.longitude + longitudeRadius,
        north: project.latitude + latitudeRadius,
      },
      controller.signal,
      { fallbackAllowed: true, includeRegistryAssets: false },
    )
      .then(({ collection: siteCollection }) => setRankingCollection(siteCollection))
      .catch(() => {
        if (!controller.signal.aborted) {
          setRankingCollection(null);
          setRankingState("error");
        }
      });
    return () => controller.abort();
  }, [
    maxDistanceKm,
    project.latitude,
    project.longitude,
    regionCode,
    setRanking,
    setRankingCollection,
    setRankingState,
  ]);
}
