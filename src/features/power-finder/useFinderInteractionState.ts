import { type CandidateOpportunity } from "@/features/power-finder/candidate-intelligence";
import { type FinderProject } from "@/features/power-finder/finder-project";
import { type PowerFinderFeature } from "@/features/power-finder/fixture-data";
import { type FinderNumericField } from "@/features/power-finder/project-validation";
import { useRef,useState } from "react";
import type { FinderSearch } from "./search-contract";

export function useFinderInteractionState(search: FinderSearch, project: FinderProject) {
  const [selected, setSelected] = useState<PowerFinderFeature | null>(null);

  const [selectedOpportunitySnapshot, setSelectedOpportunitySnapshot] =
    useState<CandidateOpportunity | null>(null);

  const detailPanelRef = useRef<HTMLElement | null>(null);

  const detailReturnFocusRef = useRef<HTMLElement | null>(null);

  const [showAllCandidates, setShowAllCandidates] = useState(false);

  const [numericDrafts, setNumericDrafts] = useState<Record<FinderNumericField, string>>(() => ({
    latitude: project.latitude?.toString() ?? "",
    longitude: project.longitude?.toString() ?? "",
    importMw: project.importMw.toString(),
    exportMw: project.exportMw.toString(),
    batteryPowerMw: project.batteryPowerMw.toString(),
    batteryEnergyMwh: project.batteryEnergyMwh.toString(),
  }));

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FinderNumericField, string>>>({});

  const [interactionNotice, setInteractionNotice] = useState("");

  const [previewCandidateId, setPreviewCandidateId] = useState<string | null>(null);

  const [comparisonOpen, setComparisonOpen] = useState(false);

  const [projectEditorOpen, setProjectEditorOpen] = useState(
    Boolean(search.projectType || search.exportMw || search.batteryMw || search.batteryMwh),
  );

  const [secondaryControlsOpen, setSecondaryControlsOpen] = useState(Boolean(search.propertyId));

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [legendOpen, setLegendOpen] = useState(false);

  const detailDismissedRef = useRef(false);
  return {
    selected,
    setSelected,
    selectedOpportunitySnapshot,
    setSelectedOpportunitySnapshot,
    detailPanelRef,
    detailReturnFocusRef,
    showAllCandidates,
    setShowAllCandidates,
    numericDrafts,
    setNumericDrafts,
    fieldErrors,
    setFieldErrors,
    interactionNotice,
    setInteractionNotice,
    previewCandidateId,
    setPreviewCandidateId,
    comparisonOpen,
    setComparisonOpen,
    projectEditorOpen,
    setProjectEditorOpen,
    secondaryControlsOpen,
    setSecondaryControlsOpen,
    sidebarOpen,
    setSidebarOpen,
    legendOpen,
    setLegendOpen,
    detailDismissedRef,
  };
}
