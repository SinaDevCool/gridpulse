import type { ActivationStudyTab } from "@/components/product/ActivationStudyPanel";
import type { InteractiveLegendSection } from "@/components/product/InteractiveMapLegend";
import { type CandidateOpportunity } from "@/features/power-finder/candidate-intelligence";
import { type FinderProject } from "@/features/power-finder/finder-project";
import { type PowerFinderCollection } from "@/features/power-finder/fixture-data";
import { type CandidateSort } from "./page-formatting";
export interface FinderDataContract {
  basemapMode: import("../theme/theme-contract").ResolvedTheme;
  search: {
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
  };
  collection: PowerFinderCollection | null;
  project: FinderProject;
  selected: import("@/features/power-finder/fixture-data").PowerFinderFeature | null;
  enabled: Record<import("@/features/power-finder/fixture-data").PowerFinderKind, boolean>;
  error: string;
  bounds: import("./data-source").PowerFinderBounds;
  dataMode: import("./data-source").PowerFinderDataMode | null;
  runtimeSourceStatus: Partial<Record<"grid" | "registry", "error" | "idle" | "loading" | "ready">>;
  query: string;
  minimumVoltage: number;
  selectedTso: string;
  selectedDso: string;
  candidateSort: CandidateSort;
  requiredImportMw: number;
  maxDistanceKm: number;
  saveStatus: "error" | "idle" | "saving" | "saved";
  shortlistId: string | null;
  propertySaveStatus: "error" | "idle" | "saving" | "saved";
  activeProperty: import("../anonymous-workspace/schema").AnonymousProperty | null;
  propertySaveRequest: import("react").RefObject<number>;
  detailPanelRef: import("react").RefObject<HTMLElement | null>;
  detailReturnFocusRef: import("react").RefObject<HTMLElement | null>;
  showAllCandidates: boolean;
  operatorEvidence: import("./operator-evidence").OperatorEvidenceResult | null;
  operatorEvidenceState: "idle" | "loading" | "ready" | "unavailable";
  c1Study: import("./c1-study").C1StudyPayload | null;
  numericDrafts: Record<
    "exportMw" | "latitude" | "longitude" | "importMw" | "batteryPowerMw" | "batteryEnergyMwh",
    string
  >;
  fieldErrors: Partial<
    Record<
      "exportMw" | "latitude" | "longitude" | "importMw" | "batteryPowerMw" | "batteryEnergyMwh",
      string
    >
  >;
  interactionNotice: string;
  visibleLayerCounts: import("../../components/product/power-finder-map-data").VisibleLayerCounts;
  comparisonOpen: boolean;
  projectEditorOpen: boolean;
  secondaryControlsOpen: boolean;
  sidebarOpen: boolean;
  legendOpen: boolean;
  showDataCentres: boolean;
  selectedDataCentre: import("../map/contracts").RzRegDataCentre | null;
  finderWorkflow: "screen" | "discover";
  discoveryStrategy: import("./location-discovery").DiscoveryStrategy;
  discoveryResultCount: 20 | 10;
  discoveryResults: import("./location-discovery").DiscoveryLocation[];
  selectedDiscoveryId: string | null;
  discoveryState: "error" | "idle" | "loading" | "ready";
  generationGroup: string;
  mapFilters: {
    preset: "connection" | "infrastructure" | "generation";
    isolation: import("@/features/map/map-filter-state").MapIsolation;
    minimumGenerationMw: number;
    maximumGenerationMw: number | null;
    minimumStorageMw: number;
    maximumStorageMw: number | null;
    scaleMarkersByCapacity: boolean;
  };
  layersMenuOpen: boolean;
  minimumGenerationMw: number;
  minimumStorageMw: number;
  basemapStatus: import("./basemap-config").BasemapStatus;
  mapRetryKey: number;
  mapNavigationTarget:
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
    | undefined;
  ranking: import("@/features/power-finder/candidate-intelligence").RankedCandidateResult | null;
  rankingCollection: PowerFinderCollection | null;
  rankingState: "error" | "loading" | "ready";
  coverage: import("@/features/power-finder/coverage").PowerFinderCoverage[];
  operatorCatalog: import("./operator-catalog").GridOperatorOption[];
  operatorCatalogState: "loading" | "ready" | "unavailable";
  regionCode:
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
    | "DE-TH";
  mapMode: "voltage" | "evidence" | "capacity";
  capacityMetric: import("@/features/power-finder/calculated-capacity").CapacityMetric;
  requiredCapacityMw: number;
  capacitySource: "private" | "berlin_synthetic";
  capacityViewport:
    | import("@/features/power-finder/calculated-capacity").CalculatedCapacityViewport
    | null;
  berlinCapacity:
    | import("@/features/power-finder/calculated-capacity").BerlinSyntheticCapacityArtifact
    | null;
  capacityState: "error" | "idle" | "loading" | "ready";
  mapSourceSummary: import("@/features/map/map-source-registry").MapSourceSummary | null;
  registryAssetsUnavailable: boolean;
  effectiveGenerationGroup: string;
  effectiveEnabled: {
    generation_asset: boolean;
    storage_asset: boolean;
    node: boolean;
    line: boolean;
    industrial_site: boolean;
  };
  legendSections: InteractiveLegendSection[];
  activeLegendTitle: string;
  activeCoverage: import("@/features/power-finder/coverage").PowerFinderCoverage;
  viewportTarget: {
    center: [number, number];
    zoom: number;
  };
  projectSite: [number, number] | null;
  visibleCollection: PowerFinderCollection | null;
  transmissionOperators: import("./operator-catalog").GridOperatorOption[];
  distributionOperators: import("./operator-catalog").GridOperatorOption[];
  activeCapacityNodes: import("@/features/power-finder/calculated-capacity").CalculatedCapacityNode[];
  candidateSelection: {
    items: CandidateOpportunity[];
    tsoFallback: boolean;
    dsoFallback: boolean;
  };
  candidates: CandidateOpportunity[];
  visibleCandidates: CandidateOpportunity[];
  capacitySummary: {
    meets: number;
    activation: number;
    below: number;
    stale: number;
    unknown: number;
  };
  selectedOpportunity: CandidateOpportunity | undefined;
  selectedDetailFeature: import("@/features/power-finder/fixture-data").PowerFinderFeature | null;
  selectedCapacity:
    | import("@/features/power-finder/calculated-capacity").CalculatedCapacityNode
    | null;
  selectedCapacityOpportunity: import("@/features/power-finder/capacity-opportunity").CapacityOpportunity;
  selectedNodePathways: CandidateOpportunity[];
  previewFeature: import("@/features/power-finder/fixture-data").PowerFinderFeature | null;
  comparisonIds: string[];
  comparedCandidates: CandidateOpportunity[];
  comparedActivation: Map<
    string,
    import("@/features/power-finder/activation-study").ActivationStudyContext
  >;
  coordinates: [number, number] | null;
  activationOpen: boolean;
  activationTab: ActivationStudyTab;
  projectHydrated: boolean;
  legacyOperator: string;
  operators: import("./operator-catalog").GridOperatorOption[];
  detailDismissedRef: import("react").RefObject<boolean>;
}
