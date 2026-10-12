import { finderMvpFeatures } from "@/config/product-mode";
import { getAnonymousProperty } from "@/features/anonymous-workspace/repository";
import { loadFinderProject,saveFinderProject } from "@/features/power-finder/project-store";
import { suggestScreeningVoltage } from "@/features/power-finder/site-screening-context";
import { useEffect } from "react";
import type { useFinderController } from "./use-finder-controller";
type Context = Pick<
  ReturnType<typeof useFinderController>,
  | "navigate"
  | "search"
  | "project"
  | "setProject"
  | "projectHydrated"
  | "setProjectHydrated"
  | "maxDistanceKm"
  | "setActiveProperty"
  | "updateSearch"
  | "setInteractionNotice"
  | "setSecondaryControlsOpen"
>;
export function useFinderProjectEffects(context: Context) {
  const {
    navigate,
    search,
    project,
    setProject,
    projectHydrated,
    setProjectHydrated,
    maxDistanceKm,
    setActiveProperty,
    updateSearch,
    setInteractionNotice,
    setSecondaryControlsOpen,
  } = context;
  useEffect(() => {
    const saved = loadFinderProject();
    setProject({
      ...saved,
      type: finderMvpFeatures.dataCentreOnly ? "data_centre" : (search.projectType ?? saved.type),
      latitude: search.lat ?? saved.latitude,
      longitude: search.lng ?? saved.longitude,
      importMw: search.mw ?? saved.importMw,
      ultimateImportMw: search.mw ?? saved.ultimateImportMw,
      minimumFirmMw: search.mw ?? saved.minimumFirmMw,
      exportMw: search.exportMw ?? saved.exportMw,
      flexibleLoadMw: search.flexibleMw ?? saved.flexibleLoadMw,
      batteryPowerMw: search.batteryMw ?? saved.batteryPowerMw,
      batteryEnergyMwh: search.batteryMwh ?? saved.batteryEnergyMwh,
      maxDistanceKm: search.distance ?? saved.maxDistanceKm,
      preferredVoltageKv: search.preferredVoltage ?? saved.preferredVoltageKv,
    });
    setProjectHydrated(true);
    // The persisted project is intentionally loaded after hydration so the server and first client
    // render stay identical. URL values remain authoritative over device-local values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (projectHydrated) void saveFinderProject(project);
  }, [project, projectHydrated]);
  useEffect(() => {
    if (!search.propertyId) {
      setActiveProperty(null);
      return;
    }
    void getAnonymousProperty(search.propertyId).then((property) => {
      if (!property) return;
      const suggestedVoltage = suggestScreeningVoltage(
        property.project.importMw,
        property.project.type,
        search.preferredVoltage ?? property.project.preferredVoltageKv,
      );
      setActiveProperty(property);
      setProject({ ...property.project, preferredVoltageKv: suggestedVoltage });
      setSecondaryControlsOpen(true);
      setInteractionNotice(
        `Loaded ${property.name} and focused its declared location. ${suggestedVoltage} kV is a screening suggestion, not a connection requirement.`,
      );
      if (search.voltage == null || search.preferredVoltage == null) {
        void updateSearch({
          voltage: search.voltage ?? suggestedVoltage,
          preferredVoltage: search.preferredVoltage ?? suggestedVoltage,
        });
      }
    });
    // The property ID intentionally controls this one-time device-local lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.propertyId]);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search);
    const patch: Partial<typeof search> = {};
    let normalized = false;
    for (const key of [
      "lat",
      "lng",
      "mw",
      "exportMw",
      "flexibleMw",
      "batteryMw",
      "batteryMwh",
      "distance",
      "voltage",
      "sort",
      "region",
      "mapMode",
      "projectType",
      "preferredVoltage",
    ] as const) {
      if (raw.has(key) && search[key] === undefined) {
        Object.assign(patch, { [key]: undefined });
        normalized = true;
      }
    }
    if (normalized) {
      setInteractionNotice("One or more invalid URL values were ignored.");
      void navigate({
        to: "/power-finder",
        search: (current) => ({ ...current, ...patch }),
        replace: true,
      });
    }
  }, [navigate, search, setInteractionNotice]);
}
