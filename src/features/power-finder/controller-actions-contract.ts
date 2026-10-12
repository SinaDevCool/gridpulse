import { type MapPreset } from "@/features/map/map-filter-state";
import { type CandidateOpportunity } from "@/features/power-finder/candidate-intelligence";
import { type FinderProject } from "@/features/power-finder/finder-project";
import { type PowerFinderCollection } from "@/features/power-finder/fixture-data";
import { type FinderNumericField } from "@/features/power-finder/project-validation";
import { type ChangeEvent } from "react";
export interface FinderActionsContract {
  navigate: import("@tanstack/router-core").UseNavigateResult<"/power-finder">;
  setProject: import("react").Dispatch<import("react").SetStateAction<FinderProject>>;
  setSelected: import("react").Dispatch<
    import("react").SetStateAction<
      import("@/features/power-finder/fixture-data").PowerFinderFeature | null
    >
  >;
  setSelectedOpportunitySnapshot: import("react").Dispatch<
    import("react").SetStateAction<CandidateOpportunity | null>
  >;
  setEnabled: import("react").Dispatch<
    import("react").SetStateAction<
      Record<import("@/features/power-finder/fixture-data").PowerFinderKind, boolean>
    >
  >;
  setBounds: import("react").Dispatch<
    import("react").SetStateAction<import("./data-source").PowerFinderBounds>
  >;
  setRuntimeSourceStatus: import("react").Dispatch<
    import("react").SetStateAction<
      Partial<Record<"grid" | "registry", "error" | "idle" | "loading" | "ready">>
    >
  >;
  setSaveStatus: import("react").Dispatch<
    import("react").SetStateAction<"error" | "idle" | "saving" | "saved">
  >;
  setShortlistId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setPropertySaveStatus: import("react").Dispatch<
    import("react").SetStateAction<"error" | "idle" | "saving" | "saved">
  >;
  setActiveProperty: import("react").Dispatch<
    import("react").SetStateAction<import("../anonymous-workspace/schema").AnonymousProperty | null>
  >;
  setShowAllCandidates: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  updateSearch: (
    patch: Partial<{
      sort?: "context" | "name" | "voltage" | undefined;
      q?: string | undefined;
      voltage?: number | undefined;
      operator?: string | undefined;
      tso?: string | undefined;
      dso?: string | undefined;
      workflow?: "screen" | "discover" | undefined;
      mw?: number | undefined;
      distance?: number | undefined;
      candidate?: string | undefined;
      compare?: string | undefined;
      region?:
        | "DE"
        | "DE-BB"
        | "DE-BW"
        | "DE-BY"
        | "DE-BE"
        | "DE-HB"
        | "DE-HH"
        | "DE-HE"
        | "DE-MV"
        | "DE-NI"
        | "DE-NW"
        | "DE-RP"
        | "DE-SL"
        | "DE-SN"
        | "DE-ST"
        | "DE-SH"
        | "DE-TH"
        | undefined;
      mapMode?: "voltage" | "evidence" | "capacity" | undefined;
      mapView?: "connection" | "infrastructure" | "generation" | undefined;
      isolateVoltage?: "ehv" | "220kv" | "110kv" | "distribution" | "unknown" | undefined;
      isolateTechnology?:
        | "storage"
        | "solar"
        | "wind"
        | "biomass"
        | "hydro"
        | "geothermal"
        | "nuclear"
        | "gas"
        | "fossil_other"
        | "other"
        | undefined;
      generationMinMw?: number | undefined;
      generationMaxMw?: number | undefined;
      storageMinMw?: number | undefined;
      storageMaxMw?: number | undefined;
      capacitySource?: "reference" | "private" | "demo" | "berlin_synthetic" | undefined;
      capacityMetric?:
        | "n0_import_mw"
        | "firm_import_mw"
        | "flexible_import_mw"
        | "bess_assisted_import_mw"
        | "staged_initial_import_mw"
        | "eventual_import_mw"
        | undefined;
      requiredMw?: number | undefined;
      workspaceId?: string | undefined;
      study?: "activation" | undefined;
      studyTab?:
        | "options"
        | "evidence"
        | "geographic"
        | "overview"
        | "topology"
        | "hourly"
        | "commercial"
        | undefined;
      lat?: number | undefined;
      lng?: number | undefined;
      projectType?:
        | "data_centre"
        | "industrial_load"
        | "battery_storage"
        | "co_location"
        | "electrolyser"
        | "charging_hub"
        | undefined;
      exportMw?: number | undefined;
      flexibleMw?: number | undefined;
      batteryMw?: number | undefined;
      batteryMwh?: number | undefined;
      preferredVoltage?: number | undefined;
      propertyId?: string | undefined;
    }>,
  ) => Promise<void>;
  persistScreening: (
    candidatesToSave: CandidateOpportunity[],
    shortlistedCandidateId?: string | null,
  ) => Promise<string | null>;
  updateProject: (patch: Partial<FinderProject>) => void;
  updateScenarioNumber: (
    field:
      | "ultimateImportMw"
      | "minimumFirmMw"
      | "flexibleLoadMw"
      | "targetEnergisationYear"
      | "annualConsumptionGwh"
      | "maxInterruptionHours"
      | "annualInterruptionLimit"
      | "batteryRoundTripEfficiencyPct"
      | "batteryReservePct"
      | "onsiteGenerationMw",
    minimum: number,
    maximum: number,
  ) => (event: ChangeEvent<HTMLInputElement>) => void;
  setNumericDrafts: import("react").Dispatch<
    import("react").SetStateAction<
      Record<
        "exportMw" | "latitude" | "longitude" | "importMw" | "batteryPowerMw" | "batteryEnergyMwh",
        string
      >
    >
  >;
  setFieldErrors: import("react").Dispatch<
    import("react").SetStateAction<
      Partial<
        Record<
          | "exportMw"
          | "latitude"
          | "longitude"
          | "importMw"
          | "batteryPowerMw"
          | "batteryEnergyMwh",
          string
        >
      >
    >
  >;
  setInteractionNotice: import("react").Dispatch<import("react").SetStateAction<string>>;
  setPreviewCandidateId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setVisibleLayerCounts: import("react").Dispatch<
    import("react").SetStateAction<
      import("../../components/product/power-finder-map-data").VisibleLayerCounts
    >
  >;
  setComparisonOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setProjectEditorOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSecondaryControlsOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSidebarOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setLegendOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowDataCentres: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSelectedDataCentre: import("react").Dispatch<
    import("react").SetStateAction<import("../map/contracts").RzRegDataCentre | null>
  >;
  setFinderWorkflow: import("react").Dispatch<
    import("react").SetStateAction<"screen" | "discover">
  >;
  setDiscoveryStrategy: import("react").Dispatch<
    import("react").SetStateAction<import("./location-discovery").DiscoveryStrategy>
  >;
  setDiscoveryResultCount: import("react").Dispatch<import("react").SetStateAction<20 | 10>>;
  setDiscoveryResults: import("react").Dispatch<
    import("react").SetStateAction<import("./location-discovery").DiscoveryLocation[]>
  >;
  setSelectedDiscoveryId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setDiscoveryState: import("react").Dispatch<
    import("react").SetStateAction<"error" | "idle" | "loading" | "ready">
  >;
  invalidateDiscoveryResults: () => void;
  setGenerationGroup: import("react").Dispatch<import("react").SetStateAction<string>>;
  dispatchMapFilter: import("react").ActionDispatch<
    [action: import("@/features/map/map-filter-state").SharedMapFilterAction]
  >;
  setLayersMenuOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setMinimumGenerationMw: (minimum: number) => void;
  setMaximumGenerationMw: (maximum: number | null) => void;
  setMinimumStorageMw: (minimum: number) => void;
  setMaximumStorageMw: (maximum: number | null) => void;
  setBasemapStatus: import("react").Dispatch<
    import("react").SetStateAction<import("./basemap-config").BasemapStatus>
  >;
  setMapRetryKey: import("react").Dispatch<import("react").SetStateAction<number>>;
  setMapNavigationTarget: import("react").Dispatch<
    import("react").SetStateAction<
      | {
          requestId: number;
          kind: "point";
          center: [number, number];
          zoom?: number;
        }
      | {
          requestId: number;
          kind: "bounds";
          bounds: [number, number, number, number];
          maxZoom?: number;
        }
      | undefined
    >
  >;
  navigateMapToPoint: (center: [number, number]) => void;
  commitNumber: (
    field: FinderNumericField,
    raw: string,
    commit: (value: number | null) => void,
    optional?: boolean,
  ) => void;
  setMapMode: import("react").Dispatch<
    import("react").SetStateAction<"voltage" | "evidence" | "capacity">
  >;
  setCapacityMetric: import("react").Dispatch<
    import("react").SetStateAction<
      import("@/features/power-finder/calculated-capacity").CapacityMetric
    >
  >;
  setRequiredCapacityMw: import("react").Dispatch<import("react").SetStateAction<number>>;
  setCapacitySource: import("react").Dispatch<
    import("react").SetStateAction<"private" | "berlin_synthetic">
  >;
  isolatedVoltageClass: "ehv" | "220kv" | "110kv" | "distribution" | "unknown" | null;
  applyMapPreset: (preset: MapPreset) => void;
  isolateMapLegendItem: (dimension: string, value: string) => void;
  closeDetail: () => Promise<void>;
  startPrivateAssessment: (studyInput?: {
    selectedOptionKind: string | null;
    commercialAssumptions: import("@/features/power-finder/activation-study").RepresentativeCommercialAssumptions;
  }) => Promise<void>;
  isolatedTechnology:
    | "storage"
    | "solar"
    | "wind"
    | "biomass"
    | "hydro"
    | "geothermal"
    | "nuclear"
    | "gas"
    | "fossil_other"
    | "other"
    | null;
  setCollection: import("react").Dispatch<
    import("react").SetStateAction<PowerFinderCollection | null>
  >;
  setError: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDataMode: import("react").Dispatch<
    import("react").SetStateAction<import("./data-source").PowerFinderDataMode | null>
  >;
  setRanking: import("react").Dispatch<
    import("react").SetStateAction<
      import("@/features/power-finder/candidate-intelligence").RankedCandidateResult | null
    >
  >;
  setRankingCollection: import("react").Dispatch<
    import("react").SetStateAction<PowerFinderCollection | null>
  >;
  setRankingState: import("react").Dispatch<
    import("react").SetStateAction<"error" | "loading" | "ready">
  >;
  setCoverage: import("react").Dispatch<
    import("react").SetStateAction<import("@/features/power-finder/coverage").PowerFinderCoverage[]>
  >;
  setOperatorCatalog: import("react").Dispatch<
    import("react").SetStateAction<import("./operator-catalog").GridOperatorOption[]>
  >;
  setOperatorCatalogState: import("react").Dispatch<
    import("react").SetStateAction<"loading" | "ready" | "unavailable">
  >;
  setCapacityViewport: import("react").Dispatch<
    import("react").SetStateAction<
      import("@/features/power-finder/calculated-capacity").CalculatedCapacityViewport | null
    >
  >;
  setBerlinCapacity: import("react").Dispatch<
    import("react").SetStateAction<
      import("@/features/power-finder/calculated-capacity").BerlinSyntheticCapacityArtifact | null
    >
  >;
  setCapacityState: import("react").Dispatch<
    import("react").SetStateAction<"error" | "idle" | "loading" | "ready">
  >;
  setProjectHydrated: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  navigateMapToOperator: (operatorName: string) => void;
  setOperatorEvidence: import("react").Dispatch<
    import("react").SetStateAction<import("./operator-evidence").OperatorEvidenceResult | null>
  >;
  setOperatorEvidenceState: import("react").Dispatch<
    import("react").SetStateAction<"idle" | "loading" | "ready" | "unavailable">
  >;
  setC1Study: import("react").Dispatch<
    import("react").SetStateAction<import("./c1-study").C1StudyPayload | null>
  >;
}
