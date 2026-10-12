import type { AnonymousProperty } from "@/features/anonymous-workspace/schema";
import { defaultFinderProject,type FinderProject } from "@/features/power-finder/finder-project";
import { useRef,useState } from "react";
import type { FinderSearch } from "./search-contract";

export function useFinderProjectState(search: FinderSearch) {
  const [project, setProject] = useState<FinderProject>(() => {
    return {
      ...defaultFinderProject,
      type: search.projectType ?? defaultFinderProject.type,
      latitude: search.lat ?? defaultFinderProject.latitude,
      longitude: search.lng ?? defaultFinderProject.longitude,
      importMw: search.mw ?? defaultFinderProject.importMw,
      ultimateImportMw: search.mw ?? defaultFinderProject.ultimateImportMw,
      minimumFirmMw: search.mw ?? defaultFinderProject.minimumFirmMw,
      exportMw: search.exportMw ?? defaultFinderProject.exportMw,
      flexibleLoadMw: search.flexibleMw ?? defaultFinderProject.flexibleLoadMw,
      batteryPowerMw: search.batteryMw ?? defaultFinderProject.batteryPowerMw,
      batteryEnergyMwh: search.batteryMwh ?? defaultFinderProject.batteryEnergyMwh,
      maxDistanceKm: search.distance ?? defaultFinderProject.maxDistanceKm,
      preferredVoltageKv: search.preferredVoltage ?? defaultFinderProject.preferredVoltageKv,
    };
  });

  const [projectHydrated, setProjectHydrated] = useState(false);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [shortlistId, setShortlistId] = useState<string | null>(null);

  const [propertySaveStatus, setPropertySaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const [activeProperty, setActiveProperty] = useState<AnonymousProperty | null>(null);

  const propertySaveRequest = useRef(0);
  return {
    project,
    setProject,
    projectHydrated,
    setProjectHydrated,
    saveStatus,
    setSaveStatus,
    shortlistId,
    setShortlistId,
    propertySaveStatus,
    setPropertySaveStatus,
    activeProperty,
    setActiveProperty,
    propertySaveRequest,
  };
}
