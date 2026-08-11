import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  GitCompareArrows,
  Database,
  Download,
  ExternalLink,
  MapPin,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { z } from "zod";
import { AppShell } from "@/components/product/AppShell";
import { PowerFinderMap } from "@/components/product/PowerFinderMap";
import type { ActivationStudyTab } from "@/components/product/ActivationStudyPanel";
import type { VisibleLayerCounts } from "@/components/product/power-finder-map-data";
import { integratedActivationStudyEnabled, productCapabilities } from "@/config/product-mode";
import {
  featureSummary,
  pointCoordinates,
  type PowerFinderCollection,
  type PowerFinderFeature,
  type PowerFinderKind,
} from "@/features/power-finder/fixture-data";
import { GRID_VOLTAGE_CLASSES } from "@/features/power-finder/voltage-style";
import { layerAvailability } from "@/features/power-finder/layer-availability";
import {
  loadPowerFinderViewport,
  type PowerFinderDataMode,
  type PowerFinderBounds,
} from "@/features/power-finder/data-source";
import {
  fallbackCoverage,
  loadPowerFinderCoverage,
  type PowerFinderCoverage,
} from "@/features/power-finder/coverage";
import { savePowerFinderCandidate } from "@/features/power-finder/shortlist";
import {
  loadOperatorEvidence,
  type OperatorEvidenceResult,
} from "@/features/power-finder/operator-evidence";
import {
  applyPreferredVoltageContext,
  highestRankedOpportunityForNode,
  opportunityNode,
  rankCandidatesForLocation,
  voltageFitLabels,
  type CandidateOpportunity,
  type RankedCandidateResult,
} from "@/features/power-finder/candidate-intelligence";
import {
  defaultFinderProject,
  finderProjectTypes,
  isStorageProject,
  type FinderProject,
  type FinderProjectType,
} from "@/features/power-finder/finder-project";
import { loadFinderProject, saveFinderProject } from "@/features/power-finder/project-store";
import { downloadFinderReport } from "@/features/power-finder/finder-report";
import {
  addComparisonCandidate,
  parseComparison,
  removeComparisonCandidate,
  serializeComparison,
} from "@/features/power-finder/candidate-comparison";
import {
  validateFinderNumber,
  type FinderNumericField,
} from "@/features/power-finder/project-validation";
import { loadC1Study, type C1StudyPayload } from "@/features/power-finder/c1-study";
import { canonicalOperatorName } from "@/features/power-finder/operator-normalization";
import {
  loadGridOperatorCatalog,
  type GridOperatorOption,
} from "@/features/power-finder/operator-catalog";
import { operatorBoundsIntersect } from "@/features/power-finder/operator-map-navigation";
import {
  activationStudySnapshot,
  createActivationStudyContext,
} from "@/features/power-finder/activation-study";
import {
  capacityMetricLabels,
  loadBerlinSyntheticCapacity,
  loadCalculatedCapacityViewport,
  type BerlinSyntheticCapacityArtifact,
  type CalculatedCapacityViewport,
  type CapacityMetric,
} from "@/features/power-finder/calculated-capacity";
import {
  classifyCapacityOpportunity,
  summariseCapacityOpportunities,
} from "@/features/power-finder/capacity-opportunity";

const safeNumber = (minimum: number, maximum: number) =>
  z.coerce.number().min(minimum).max(maximum).optional().catch(undefined);

const ActivationStudyPanel = lazy(() =>
  import("@/components/product/ActivationStudyPanel").then((module) => ({
    default: module.ActivationStudyPanel,
  })),
);

export const Route = createFileRoute("/power-finder")({
  validateSearch: z.object({
    q: z.string().max(160).optional().catch(undefined),
    voltage: z.coerce
      .number()
      .refine((value) => [0, 20, 110, 220, 380].includes(value))
      .optional()
      .catch(undefined),
    operator: z.string().max(160).optional().catch(undefined),
    tso: z.string().max(160).optional().catch(undefined),
    dso: z.string().max(160).optional().catch(undefined),
    sort: z.enum(["context", "voltage", "name"]).optional().catch(undefined),
    mw: safeNumber(0.1, 1000),
    distance: safeNumber(1, 100),
    candidate: z.string().max(200).optional().catch(undefined),
    compare: z.string().max(700).optional().catch(undefined),
    region: z
      .enum([
        "DE",
        "DE-BB",
        "DE-BW",
        "DE-BY",
        "DE-BE",
        "DE-HB",
        "DE-HH",
        "DE-HE",
        "DE-MV",
        "DE-NI",
        "DE-NW",
        "DE-RP",
        "DE-SL",
        "DE-SN",
        "DE-ST",
        "DE-SH",
        "DE-TH",
      ])
      .optional()
      .catch(undefined),
    mapMode: z.enum(["voltage", "evidence", "capacity"]).optional().catch(undefined),
    capacitySource: z
      .enum(["reference", "private", "demo", "berlin_synthetic"])
      .optional()
      .catch(undefined),
    capacityMetric: z
      .enum([
        "n0_import_mw",
        "firm_import_mw",
        "flexible_import_mw",
        "bess_assisted_import_mw",
        "staged_initial_import_mw",
        "eventual_import_mw",
      ])
      .optional()
      .catch(undefined),
    requiredMw: safeNumber(0.1, 1000),
    workspaceId: z.string().uuid().optional().catch(undefined),
    study: z.enum(["activation"]).optional().catch(undefined),
    studyTab: z
      .enum(["geographic", "overview", "topology", "hourly", "options", "commercial", "evidence"])
      .optional()
      .catch(undefined),
    lat: safeNumber(47, 56),
    lng: safeNumber(5, 16),
    projectType: z
      .enum([
        "data_centre",
        "industrial_load",
        "battery_storage",
        "co_location",
        "electrolyser",
        "charging_hub",
      ])
      .optional()
      .catch(undefined),
    exportMw: safeNumber(0, 1000),
    flexibleMw: safeNumber(0, 1000),
    batteryMw: safeNumber(0, 1000),
    batteryMwh: safeNumber(0, 20_000),
    preferredVoltage: z.coerce
      .number()
      .refine((value) => [0, 20, 110, 220, 380].includes(value))
      .optional()
      .catch(undefined),
  }),
  head: () => ({
    meta: [
      { title: "Power Finder | GridPulse" },
      {
        name: "description",
        content:
          "Screen German grid nodes, mapped voltage, industrial sites and source evidence without creating an account.",
      },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/power-finder" }],
  }),
  component: PowerFinderPage,
});

const kindLabels: Record<PowerFinderKind, string> = {
  node: "Grid nodes",
  line: "Mapped grid corridors",
  industrial_site: "Industrial sites",
  generation_asset: "Registered generation · exact public locations",
  storage_asset: "Registered storage",
};
const initialBounds: PowerFinderBounds = {
  west: 12.9,
  south: 52.1,
  east: 13.8,
  north: 52.6,
};
type CandidateSort = "context" | "voltage" | "name";
const distanceFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const scoreFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const mwFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

function formatScore(value: number) {
  return scoreFormatter.format(value);
}

function formatMw(value: number) {
  return `${mwFormatter.format(value)} MW`;
}

function PowerFinderPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [collection, setCollection] = useState<PowerFinderCollection | null>(null);
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
  const [selected, setSelected] = useState<PowerFinderFeature | null>(null);
  const [selectedOpportunitySnapshot, setSelectedOpportunitySnapshot] =
    useState<CandidateOpportunity | null>(null);
  const [enabled, setEnabled] = useState<Record<PowerFinderKind, boolean>>({
    node: true,
    line: true,
    industrial_site: true,
    generation_asset: false,
    storage_asset: false,
  });
  const [error, setError] = useState("");
  const [bounds, setBounds] = useState(initialBounds);
  const [dataMode, setDataMode] = useState<PowerFinderDataMode | null>(null);
  const query = search.q ?? "";
  const minimumVoltage = search.voltage ?? 0;
  const legacyOperator = search.operator ?? "all";
  const selectedTso = search.tso ?? "all";
  const selectedDso = search.dso ?? "all";
  const candidateSort: CandidateSort = search.sort ?? "context";
  const requiredImportMw = project.importMw;
  const maxDistanceKm = project.maxDistanceKm;
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shortlistId, setShortlistId] = useState<string | null>(null);
  const [operatorEvidence, setOperatorEvidence] = useState<OperatorEvidenceResult | null>(null);
  const [operatorEvidenceState, setOperatorEvidenceState] = useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");
  const [c1Study, setC1Study] = useState<C1StudyPayload | null>(null);
  const updateSearch = (patch: Partial<typeof search>) =>
    navigate({
      to: "/power-finder",
      search: (current) => ({ ...current, ...patch }),
      replace: true,
    });
  const updateProject = (patch: Partial<FinderProject>) => {
    setProject((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  };
  const updateScenarioNumber =
    (
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
    ) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isFinite(value))
        updateProject({ [field]: Math.min(maximum, Math.max(minimum, value)) });
    };
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
  const [visibleLayerCounts, setVisibleLayerCounts] = useState<VisibleLayerCounts>({
    node: 0,
    line: 0,
    industrial_site: 0,
    generation_asset: 0,
    storage_asset: 0,
  });
  const [reportPreparing, setReportPreparing] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [projectEditorOpen, setProjectEditorOpen] = useState(
    Boolean(search.projectType || search.exportMw || search.batteryMw || search.batteryMwh),
  );
  const [secondaryControlsOpen, setSecondaryControlsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapNavigationTarget, setMapNavigationTarget] = useState<
    | { requestId: number; kind: "point"; center: [number, number]; zoom?: number }
    | {
        requestId: number;
        kind: "bounds";
        bounds: [number, number, number, number];
        maxZoom?: number;
      }
    | undefined
  >();
  const navigateMapToPoint = (center: [number, number]) =>
    setMapNavigationTarget({ requestId: Date.now(), kind: "point", center, zoom: 11 });
  const navigateMapToOperator = (operatorName: string) => {
    if (operatorName === "all") return;
    const selectedOperator = operators.find((item) => item.name === operatorName);
    if (!selectedOperator?.bounds) {
      setInteractionNotice(
        `${operatorName} was selected, but its mapped geographic extent is not available yet.`,
      );
      return;
    }
    setMapNavigationTarget({
      requestId: Date.now(),
      kind: "bounds",
      bounds: selectedOperator.bounds,
      maxZoom: selectedOperator.type === "TSO" ? 7.5 : 10,
    });
    setInteractionNotice(
      `Map fitted to the mapped ${selectedOperator.type} extent for ${operatorName}.`,
    );
  };
  const commitNumber = (
    field: FinderNumericField,
    raw: string,
    commit: (value: number | null) => void,
    optional = false,
  ) => {
    setNumericDrafts((current) => ({ ...current, [field]: raw }));
    if (optional && !raw.trim()) {
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
      commit(null);
      return;
    }
    const result = validateFinderNumber(field, raw);
    setFieldErrors((current) => ({ ...current, [field]: result.error ?? undefined }));
    if (!result.error) commit(result.value);
  };
  const [ranking, setRanking] = useState<RankedCandidateResult | null>(null);
  const [rankingCollection, setRankingCollection] = useState<PowerFinderCollection | null>(null);
  const [rankingState, setRankingState] = useState<"loading" | "ready" | "error">("loading");
  const [coverage, setCoverage] = useState<PowerFinderCoverage[]>(fallbackCoverage);
  const [operatorCatalog, setOperatorCatalog] = useState<GridOperatorOption[]>([]);
  const regionCode = search.region ?? "DE";
  const [mapMode, setMapMode] = useState<"voltage" | "evidence" | "capacity">(
    search.mapMode ?? "voltage",
  );
  const [capacityMetric, setCapacityMetric] = useState<CapacityMetric>(
    search.capacityMetric ?? "firm_import_mw",
  );
  const [requiredCapacityMw, setRequiredCapacityMw] = useState(
    search.requiredMw ?? project.importMw,
  );
  const [capacitySource, setCapacitySource] = useState<"private" | "berlin_synthetic">(
    search.capacitySource === "private" && search.workspaceId ? "private" : "berlin_synthetic",
  );
  const [capacityViewport, setCapacityViewport] = useState<CalculatedCapacityViewport | null>(null);
  const [berlinCapacity, setBerlinCapacity] = useState<BerlinSyntheticCapacityArtifact | null>(
    null,
  );
  const [capacityState, setCapacityState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const activeCoverage =
    coverage.find((item) => item.regionCode === regionCode) ?? fallbackCoverage[1];
  const viewportTarget = useMemo(
    () => ({ center: activeCoverage.center, zoom: activeCoverage.zoom }),
    [activeCoverage.center, activeCoverage.zoom],
  );

  useEffect(() => {
    void loadGridOperatorCatalog()
      .then(setOperatorCatalog)
      .catch(() => setOperatorCatalog([]));
  }, []);

  useEffect(() => {
    const privateCapacitySelected =
      search.capacitySource === "private" && Boolean(search.workspaceId);
    const requestedMetric = search.capacityMetric ?? "firm_import_mw";
    const safeMetric =
      privateCapacitySelected ||
      requestedMetric === "n0_import_mw" ||
      requestedMetric === "firm_import_mw"
        ? requestedMetric
        : "firm_import_mw";
    setMapMode(search.mapMode ?? "voltage");
    setCapacitySource(privateCapacitySelected ? "private" : "berlin_synthetic");
    setCapacityMetric(safeMetric);
    setRequiredCapacityMw(search.requiredMw ?? project.importMw);
  }, [
    search.capacityMetric,
    search.capacitySource,
    search.mapMode,
    search.requiredMw,
    search.workspaceId,
    project.importMw,
  ]);

  useEffect(() => {
    if (mapMode !== "capacity") {
      return;
    }
    setCapacityState("loading");
    if (capacitySource === "berlin_synthetic") {
      void loadBerlinSyntheticCapacity()
        .then((result) => {
          setBerlinCapacity(result);
          setCapacityState("ready");
        })
        .catch(() => {
          setBerlinCapacity(null);
          setCapacityState("error");
        });
      return;
    }
    void loadCalculatedCapacityViewport({
      workspaceId: search.workspaceId,
      metric: capacityMetric,
      mappedNodeCount:
        collection?.features.filter((feature) => feature.properties.kind === "node").length ?? 0,
    })
      .then((result) => {
        setCapacityViewport(result);
        setCapacityState("ready");
      })
      .catch(() => {
        setCapacityViewport(null);
        setCapacityState("error");
      });
  }, [capacityMetric, capacitySource, collection, mapMode, search.workspaceId]);

  useEffect(() => {
    const saved = loadFinderProject();
    setProject({
      ...saved,
      type: search.projectType ?? saved.type,
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
  }, [navigate, search]);

  useEffect(() => {
    let active = true;
    void loadPowerFinderCoverage().then((result) => {
      if (active) setCoverage(result);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if ((bounds.east - bounds.west) * (bounds.north - bounds.south) > 6) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadPowerFinderViewport(bounds, controller.signal, {
        fallbackAllowed: true,
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
  }, [bounds, regionCode]);

  useEffect(() => {
    setRankingCollection(null);
    if (project.latitude == null || project.longitude == null) return;
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
      { fallbackAllowed: true },
    )
      .then(({ collection: siteCollection }) => setRankingCollection(siteCollection))
      .catch(() => {
        if (!controller.signal.aborted) setRankingState("error");
      });
    return () => controller.abort();
  }, [maxDistanceKm, project.latitude, project.longitude, regionCode]);

  const visibleCollection = useMemo<PowerFinderCollection | null>(() => {
    if (!collection) return null;
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const features = collection.features.filter((feature) => {
      const properties = feature.properties;
      const voltage = Math.max(0, ...(properties.voltage_kv ?? []));
      const matchesQuery =
        !normalizedQuery ||
        properties.name.toLocaleLowerCase().includes(normalizedQuery) ||
        properties.operator?.toLocaleLowerCase().includes(normalizedQuery) ||
        feature.id.toLocaleLowerCase().includes(normalizedQuery);
      const matchesVoltage =
        properties.kind !== "node" || minimumVoltage === 0 || voltage >= minimumVoltage;
      const canonicalOperator = canonicalOperatorName(properties.operator);
      const operatorContext = operatorCatalog.find((item) => item.name === canonicalOperator);
      const matchesTso =
        selectedTso === "all" ||
        canonicalOperator === selectedTso ||
        operatorContext?.tsoNames.includes(selectedTso);
      const matchesDso = selectedDso === "all" || canonicalOperator === selectedDso;
      const matchesOperator =
        selectedTso !== "all" && selectedDso !== "all"
          ? canonicalOperator === selectedTso || canonicalOperator === selectedDso
          : matchesTso && matchesDso;
      return enabled[properties.kind] && matchesQuery && matchesVoltage && matchesOperator;
    });
    return {
      ...collection,
      features,
      metadata: { ...collection.metadata, record_count: features.length },
    };
  }, [collection, enabled, minimumVoltage, operatorCatalog, query, selectedDso, selectedTso]);

  const operators = useMemo(() => {
    if (operatorCatalog.length) return operatorCatalog;
    return Array.from(
      new Set(
        collection?.features
          .map((feature) => canonicalOperatorName(feature.properties.operator))
          .filter((value): value is string => Boolean(value)) ?? [],
      ),
    )
      .sort((left, right) => left.localeCompare(right))
      .map((name) => ({
        name,
        type: "DSO / other" as const,
        featureCount: 0,
        bounds: null,
        tsoNames: [],
      }));
  }, [collection, operatorCatalog]);
  const regionalOperators = useMemo(
    () =>
      operators.filter(
        (item) => !item.bounds || operatorBoundsIntersect(item.bounds, activeCoverage.bounds),
      ),
    [activeCoverage.bounds, operators],
  );
  const transmissionOperators = useMemo(
    () => regionalOperators.filter((item) => item.type === "TSO"),
    [regionalOperators],
  );
  const distributionOperators = useMemo(() => {
    const regional = regionalOperators.filter((item) => item.type === "DSO / other");
    return selectedTso !== "all"
      ? regional.filter((item) => item.tsoNames.includes(selectedTso))
      : regional;
  }, [regionalOperators, selectedTso]);
  useEffect(() => {
    const tsoAvailable = transmissionOperators.some((item) => item.name === selectedTso);
    const dsoAvailable = distributionOperators.some((item) => item.name === selectedDso);
    if (selectedTso !== "all" && !tsoAvailable) {
      void updateSearch({
        tso: undefined,
        dso: undefined,
        candidate: undefined,
        compare: undefined,
      });
    } else if (selectedDso !== "all" && !dsoAvailable) {
      void updateSearch({ dso: undefined, candidate: undefined, compare: undefined });
    }
    // updateSearch is a render-local router helper; availability changes are the intended trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributionOperators, selectedDso, selectedTso, transmissionOperators]);

  useEffect(() => {
    if (selectedDso !== "all" && operators.some((item) => item.name === selectedDso)) {
      navigateMapToOperator(selectedDso);
    } else if (selectedTso !== "all" && operators.some((item) => item.name === selectedTso)) {
      navigateMapToOperator(selectedTso);
    }
    // URL selection and late catalog hydration should both focus the accepted mapped extent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operators, selectedDso, selectedTso]);

  useEffect(() => {
    if (legacyOperator === "all" || !operators.length) return;
    const legacyType = operators.find((item) => item.name === legacyOperator)?.type;
    void updateSearch({
      operator: undefined,
      tso: legacyType === "TSO" ? legacyOperator : undefined,
      dso: legacyType === "DSO / other" ? legacyOperator : undefined,
    });
    // One-time compatibility migration for shared links from the previous filter contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacyOperator, operators]);

  const activeCapacityNodes = useMemo(
    () =>
      capacitySource === "berlin_synthetic"
        ? (berlinCapacity?.results ?? [])
        : (capacityViewport?.nodes ?? []),
    [berlinCapacity?.results, capacitySource, capacityViewport?.nodes],
  );

  const candidateSelection = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const baseItems = (ranking?.candidates ?? []).filter((candidate) => {
      const node =
        opportunityNode(candidate, rankingCollection) ?? opportunityNode(candidate, collection);
      const maximumVoltage = Math.max(0, ...candidate.voltageKv);
      const matchesQuery =
        !normalizedQuery ||
        candidate.siteName.toLocaleLowerCase().includes(normalizedQuery) ||
        candidate.nodeName.toLocaleLowerCase().includes(normalizedQuery) ||
        candidate.operator?.toLocaleLowerCase().includes(normalizedQuery);
      const matchesVoltage = minimumVoltage === 0 || maximumVoltage >= minimumVoltage;
      const canonicalCandidateOperator = canonicalOperatorName(candidate.operator);
      const matchesDso = selectedDso === "all" || canonicalCandidateOperator === selectedDso;
      return matchesQuery && matchesVoltage && matchesDso && Boolean(node);
    });
    const tsoItems =
      selectedTso === "all"
        ? baseItems
        : baseItems.filter((candidate) => {
            const canonicalCandidateOperator = canonicalOperatorName(candidate.operator);
            const operatorContext = operatorCatalog.find(
              (item) => item.name === canonicalCandidateOperator,
            );
            return (
              canonicalCandidateOperator === selectedTso ||
              operatorContext?.tsoNames.includes(selectedTso)
            );
          });
    const tsoFallback = selectedTso !== "all" && tsoItems.length === 0 && baseItems.length > 0;
    const items = tsoFallback ? baseItems : tsoItems;
    items.sort((left, right) => {
      if (mapMode === "capacity") {
        const byNode = new Map(activeCapacityNodes.map((node) => [node.publicNodeId, node]));
        const order = { meets: 0, activation: 1, below: 2, stale: 3, unknown: 4 } as const;
        const leftFit = classifyCapacityOpportunity(
          byNode.get(left.nodeId),
          capacityMetric,
          requiredCapacityMw,
        );
        const rightFit = classifyCapacityOpportunity(
          byNode.get(right.nodeId),
          capacityMetric,
          requiredCapacityMw,
        );
        const fitDifference = order[leftFit.fit] - order[rightFit.fit];
        if (fitDifference) return fitDifference;
        const marginDifference = (rightFit.marginMw ?? -Infinity) - (leftFit.marginMw ?? -Infinity);
        if (marginDifference) return marginDifference;
      }
      if (candidateSort === "name") {
        return (
          left.siteName.localeCompare(right.siteName) || left.nodeName.localeCompare(right.nodeName)
        );
      }
      if (candidateSort === "voltage") {
        return Math.max(0, ...right.voltageKv) - Math.max(0, ...left.voltageKv);
      }
      return right.screeningRank - left.screeningRank;
    });
    return { items, tsoFallback };
  }, [
    candidateSort,
    capacityMetric,
    activeCapacityNodes,
    collection,
    mapMode,
    minimumVoltage,
    operatorCatalog,
    query,
    ranking,
    rankingCollection,
    requiredCapacityMw,
    selectedDso,
    selectedTso,
  ]);
  const candidates = candidateSelection.items;
  const capacitySummary = useMemo(
    () =>
      summariseCapacityOpportunities(
        activeCapacityNodes,
        capacityMetric,
        requiredCapacityMw,
        collection?.features.filter((feature) => feature.properties.kind === "node").length ?? 0,
      ),
    [activeCapacityNodes, capacityMetric, collection, requiredCapacityMw],
  );
  const selectedOpportunity =
    (selectedOpportunitySnapshot?.nodeId === String(selected?.id)
      ? selectedOpportunitySnapshot
      : null) ?? candidates.find((candidate) => candidate.id === search.candidate);
  // URL search is the durable selection source. A viewport refresh can replace the
  // feature collection between a card click and navigation completion, so rebuild
  // the detail feature from the selected opportunity instead of briefly closing it.
  const selectedDetailFeature =
    selected ??
    (selectedOpportunity
      ? (opportunityNode(selectedOpportunity, rankingCollection) ??
        opportunityNode(selectedOpportunity, collection) ?? {
          type: "Feature" as const,
          id: selectedOpportunity.nodeId,
          geometry: {
            type: "Point" as const,
            // This fallback is detail-only. The node's mapped position remains represented
            // by the ranked pathway distance and is never replaced with a capacity claim.
            coordinates: [project.longitude ?? 0, project.latitude ?? 0],
          },
          properties: {
            kind: "node" as const,
            name: selectedOpportunity.nodeName,
            operator: selectedOpportunity.operator ?? undefined,
            voltage_kv: selectedOpportunity.voltageKv,
            max_voltage_kv: Math.max(0, ...selectedOpportunity.voltageKv),
            evidence_class: "open_mapping" as const,
            capacity_state: "not_established" as const,
            source_published_at: selectedOpportunity.sourcePublishedAt ?? undefined,
          },
        })
      : null);
  const selectedCapacity = selectedDetailFeature
    ? (activeCapacityNodes.find(
        (result) => result.publicNodeId === String(selectedDetailFeature.id),
      ) ?? null)
    : null;
  const selectedCapacityOpportunity = classifyCapacityOpportunity(
    selectedCapacity,
    capacityMetric,
    requiredCapacityMw,
  );
  const selectedNodePathways = selected
    ? candidates.filter((candidate) => candidate.nodeId === String(selected.id))
    : [];
  const previewOpportunity =
    candidates.find((candidate) => candidate.id === previewCandidateId) ?? null;
  const previewFeature = previewOpportunity
    ? (opportunityNode(previewOpportunity, rankingCollection) ??
      opportunityNode(previewOpportunity, collection))
    : null;
  const comparisonIds = useMemo(() => parseComparison(search.compare), [search.compare]);
  const comparedCandidates = useMemo(
    () =>
      comparisonIds
        .map(
          (id) =>
            candidates.find((candidate) => candidate.id === id) ??
            (selectedOpportunitySnapshot?.id === id ? selectedOpportunitySnapshot : undefined),
        )
        .filter((candidate): candidate is CandidateOpportunity => Boolean(candidate)),
    [candidates, comparisonIds, selectedOpportunitySnapshot],
  );
  const comparedActivation = useMemo(
    () =>
      new Map(
        comparedCandidates.map((candidate) => [
          candidate.id,
          createActivationStudyContext({ project, candidate, registeredStudy: null }),
        ]),
      ),
    [comparedCandidates, project],
  );
  const coordinates = selected ? pointCoordinates(selected) : null;
  const activationOpen =
    productCapabilities.workspace &&
    integratedActivationStudyEnabled &&
    search.study === "activation" &&
    Boolean(selectedOpportunity);
  const activationTab: ActivationStudyTab =
    search.studyTab === "geographic" ? "overview" : (search.studyTab ?? "overview");
  const startPrivateAssessment = async (studyInput?: {
    selectedOptionKind: string | null;
    commercialAssumptions: import("@/features/power-finder/activation-study").RepresentativeCommercialAssumptions;
  }) => {
    if (!selected || !coordinates) return;
    setSaveStatus("saving");
    try {
      const activation = selectedOpportunity
        ? activationStudySnapshot(
            createActivationStudyContext({
              project,
              candidate: selectedOpportunity,
              registeredStudy: c1Study,
            }),
            studyInput,
          )
        : null;
      const id = await savePowerFinderCandidate(
        selected,
        selectedOpportunity,
        requiredImportMw,
        activation,
      );
      setShortlistId(id);
      setSaveStatus("saved");
      await navigate({
        to: "/assessments/new",
        search: {
          shortlistId: id,
          name: selectedOpportunity?.siteName ?? selected.properties.name,
          projectType: "large_load",
          importMw: requiredImportMw,
          latitude: coordinates[1],
          longitude: coordinates[0],
          federalState: "Brandenburg",
          challenge: selectedOpportunity
            ? `${selectedOpportunity.siteName} screened against ${selectedOpportunity.nodeName}. The saved Activation Study is a representative benchmark only; capacity, feasibility, cost and timing require operator confirmation.`
            : `Screening candidate ${selected.id}; capacity and operator responsibility require confirmation.`,
        },
      });
    } catch {
      setSaveStatus("error");
    }
  };
  useEffect(() => {
    if (!productCapabilities.workspace) return;
    setSaveStatus("idle");
    setShortlistId(null);
  }, [selected?.id]);

  useEffect(() => {
    if (!productCapabilities.workspace) return;
    setOperatorEvidence(null);
    if (!selected || selected.properties.kind !== "node" || dataMode !== "database") {
      setOperatorEvidenceState("idle");
      return;
    }
    const controller = new AbortController();
    setOperatorEvidenceState("loading");
    void loadOperatorEvidence(selected.id, controller.signal)
      .then((result) => {
        setOperatorEvidence(result);
        setOperatorEvidenceState("ready");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          console.warn("Operator evidence could not be loaded.", reason);
          setOperatorEvidenceState("unavailable");
        }
      });
    return () => controller.abort();
  }, [dataMode, selected]);

  useEffect(() => {
    setC1Study(null);
    if (!selected || selected.properties.kind !== "node") {
      return;
    }
    const controller = new AbortController();
    void loadC1Study(String(selected.id), controller.signal)
      .then((result) => {
        setC1Study(result);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    const sourceCollection = rankingCollection;
    if (!sourceCollection || !dataMode) return;
    if (project.latitude == null || project.longitude == null) {
      setRanking(null);
      setRankingState("ready");
      setSelectedOpportunitySnapshot(null);
      setSelected(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setRankingState("loading");
    const resultPromise = Promise.resolve(
      rankCandidatesForLocation(
        sourceCollection,
        project.longitude,
        project.latitude,
        requiredImportMw,
        maxDistanceKm,
        project.name,
      ),
    );
    void resultPromise
      .then((result) => ({
        ...result,
        candidates: applyPreferredVoltageContext(
          result.candidates,
          project.preferredVoltageKv,
          project.type,
        ),
      }))
      .then((result) => {
        if (!active) return;
        setRanking(result);
        setRankingState("ready");
      })
      .catch(() => {
        if (!active) return;
        setRanking(null);
        setRankingState("error");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [rankingCollection, dataMode, maxDistanceKm, project, requiredImportMw]);

  useEffect(() => {
    if (!selectedOpportunity || selected?.id === selectedOpportunity.nodeId) return;
    const node =
      opportunityNode(selectedOpportunity, rankingCollection) ??
      opportunityNode(selectedOpportunity, collection);
    if (node) setSelected(node);
  }, [collection, rankingCollection, selected?.id, selectedOpportunity]);

  useEffect(() => {
    if (!search.candidate) return;
    const card = document.querySelector<HTMLElement>(
      `[data-candidate-id="${CSS.escape(search.candidate)}"]`,
    );
    card?.scrollIntoView({ block: "nearest" });
  }, [search.candidate]);

  return (
    <AppShell>
      <main
        id="main-content"
        className={`power-finder-page ${sidebarOpen ? "" : "is-sidebar-collapsed"}`}
      >
        <section className="power-finder-sidebar" aria-label="Power Finder controls">
          <div className="finder-rail-sticky">
            <div className="finder-project-summary">
              <div>
                <strong>{project.name}</strong>
                <span>
                  {formatMw(project.importMw)} import · {project.preferredVoltageKv ?? "Any"} kV ·{" "}
                  {project.maxDistanceKm} km
                </span>
              </div>
              <button
                type="button"
                aria-expanded={projectEditorOpen}
                aria-controls="finder-project-editor"
                onClick={() => setProjectEditorOpen((current) => !current)}
              >
                {projectEditorOpen ? "Close" : "Edit Project"}
              </button>
            </div>
          </div>
          <header>
            <p className="context-label">Power Finder · Public-source screen</p>
            <h1>{activeCoverage.regionName} connection context</h1>
            <p>
              Explore grid proximity, mapped voltage, industrial land and the evidence behind each
              screening candidate.
            </p>
          </header>

          <aside className="power-finder-boundary">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>Screening context—not a connection offer</strong>
              <p>Unknown MW, responsibility, feasibility, cost, and dates remain unknown.</p>
            </div>
          </aside>

          <section
            id="finder-project-editor"
            className={`finder-project-panel ${projectEditorOpen ? "is-open" : ""}`}
            aria-labelledby="finder-project-title"
            hidden={!projectEditorOpen}
          >
            <div className="finder-project-heading">
              <div>
                <p className="context-label">Your screening project</p>
                <h2 id="finder-project-title">Define the site and power requirement</h2>
              </div>
              <small>Saved on this device</small>
            </div>
            <label>
              <span>Project name</span>
              <input
                name="project-name"
                autoComplete="off"
                value={project.name}
                maxLength={160}
                onChange={(event) => updateProject({ name: event.target.value })}
              />
            </label>
            <label>
              <span>Project type</span>
              <select
                name="project-type"
                value={project.type}
                onChange={(event) => {
                  const type = event.target.value as FinderProjectType;
                  updateProject({ type });
                  void updateSearch({
                    projectType: type,
                    candidate: undefined,
                    compare: undefined,
                  });
                }}
              >
                {Object.entries(finderProjectTypes).map(([value, profile]) => (
                  <option value={value} key={value}>
                    {profile.label}
                  </option>
                ))}
              </select>
              <small>{finderProjectTypes[project.type].description}</small>
            </label>
            <div className="finder-project-grid">
              <label>
                <span>Latitude</span>
                <input
                  name="site-latitude"
                  type="number"
                  min="47"
                  max="56"
                  step="0.000001"
                  value={numericDrafts.latitude}
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={Boolean(fieldErrors.latitude)}
                  aria-describedby={fieldErrors.latitude ? "latitude-error" : undefined}
                  placeholder="Click map…"
                  onChange={(event) => {
                    commitNumber(
                      "latitude",
                      event.target.value,
                      (value) => {
                        updateProject({ latitude: value });
                        void updateSearch({
                          lat: value ?? undefined,
                          candidate: undefined,
                          compare: undefined,
                        });
                      },
                      true,
                    );
                  }}
                />
                {fieldErrors.latitude && (
                  <small id="latitude-error" className="finder-field-error">
                    {fieldErrors.latitude}
                  </small>
                )}
              </label>
              <label>
                <span>Longitude</span>
                <input
                  name="site-longitude"
                  type="number"
                  min="5"
                  max="16"
                  step="0.000001"
                  value={numericDrafts.longitude}
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={Boolean(fieldErrors.longitude)}
                  aria-describedby={fieldErrors.longitude ? "longitude-error" : undefined}
                  placeholder="Click map…"
                  onChange={(event) => {
                    commitNumber(
                      "longitude",
                      event.target.value,
                      (value) => {
                        updateProject({ longitude: value });
                        void updateSearch({
                          lng: value ?? undefined,
                          candidate: undefined,
                          compare: undefined,
                        });
                      },
                      true,
                    );
                  }}
                />
                {fieldErrors.longitude && (
                  <small id="longitude-error" className="finder-field-error">
                    {fieldErrors.longitude}
                  </small>
                )}
              </label>
              <label>
                <span>Import MW</span>
                <input
                  name="import-mw"
                  type="number"
                  min="0.1"
                  max="1000"
                  step="0.1"
                  value={numericDrafts.importMw}
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={Boolean(fieldErrors.importMw)}
                  aria-describedby={fieldErrors.importMw ? "import-mw-error" : undefined}
                  onChange={(event) => {
                    commitNumber("importMw", event.target.value, (value) => {
                      if (value == null) return;
                      updateProject({
                        importMw: value,
                        ultimateImportMw:
                          project.ultimateImportMw === project.importMw
                            ? value
                            : Math.max(value, project.ultimateImportMw),
                        minimumFirmMw:
                          project.minimumFirmMw === project.importMw
                            ? value
                            : Math.min(value, project.minimumFirmMw),
                      });
                      if (mapMode === "capacity") setRequiredCapacityMw(value);
                      void updateSearch({
                        mw: value,
                        requiredMw: mapMode === "capacity" ? value : search.requiredMw,
                        candidate: undefined,
                        compare: undefined,
                      });
                    });
                  }}
                />
                {fieldErrors.importMw && (
                  <small id="import-mw-error" className="finder-field-error">
                    {fieldErrors.importMw}
                  </small>
                )}
              </label>
              {isStorageProject(project.type) && (
                <label>
                  <span>Export MW</span>
                  <input
                    name="export-mw"
                    type="number"
                    min="0"
                    max="1000"
                    step="0.1"
                    value={numericDrafts.exportMw}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-invalid={Boolean(fieldErrors.exportMw)}
                    aria-describedby={fieldErrors.exportMw ? "export-mw-error" : undefined}
                    onChange={(event) => {
                      commitNumber("exportMw", event.target.value, (value) => {
                        if (value == null) return;
                        updateProject({ exportMw: value });
                        void updateSearch({
                          exportMw: value || undefined,
                          candidate: undefined,
                          compare: undefined,
                        });
                      });
                    }}
                  />
                  {fieldErrors.exportMw && (
                    <small id="export-mw-error" className="finder-field-error">
                      {fieldErrors.exportMw}
                    </small>
                  )}
                </label>
              )}
            </div>
            <label>
              <span>Preferred search voltage</span>
              <select
                name="preferred-voltage"
                value={project.preferredVoltageKv ?? 0}
                onChange={(event) => {
                  const preferredVoltageKv = Number(event.target.value) || null;
                  updateProject({ preferredVoltageKv });
                  void updateSearch({
                    preferredVoltage: preferredVoltageKv ?? undefined,
                    candidate: undefined,
                    compare: undefined,
                  });
                }}
              >
                <option value={0}>No preference</option>
                <option value={20}>20 kV</option>
                <option value={110}>110 kV</option>
                <option value={220}>220 kV</option>
                <option value={380}>380 kV</option>
              </select>
              <small>Search context only—not a suitable or required connection voltage.</small>
            </label>
            {search.study === "activation" && (
              <details className="finder-scenario-inputs">
                <summary>Activation Study assumptions</summary>
                <p>
                  These inputs drive an explicitly synthetic, untrained hourly scenario. They do not
                  request or establish network capacity.
                </p>
                <div className="finder-project-grid">
                  <label>
                    <span>Ultimate demand MW</span>
                    <input
                      type="number"
                      min="0.1"
                      max="1000"
                      step="0.1"
                      value={project.ultimateImportMw}
                      onChange={updateScenarioNumber("ultimateImportMw", 0.1, 1000)}
                    />
                  </label>
                  <label>
                    <span>Minimum firm MW</span>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="0.1"
                      value={project.minimumFirmMw}
                      onChange={updateScenarioNumber("minimumFirmMw", 0, 1000)}
                    />
                  </label>
                  <label>
                    <span>Interruptible load MW</span>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="0.1"
                      value={project.flexibleLoadMw}
                      onChange={updateScenarioNumber("flexibleLoadMw", 0, 1000)}
                    />
                  </label>
                  <label>
                    <span>Target energisation year</span>
                    <input
                      type="number"
                      min="2026"
                      max="2050"
                      step="1"
                      value={project.targetEnergisationYear}
                      onChange={updateScenarioNumber("targetEnergisationYear", 2026, 2050)}
                    />
                  </label>
                  <label>
                    <span>Supply redundancy</span>
                    <select
                      value={project.redundancy}
                      onChange={(event) =>
                        updateProject({
                          redundancy: event.target.value as FinderProject["redundancy"],
                        })
                      }
                    >
                      <option value="single_feed">Single feed</option>
                      <option value="dual_feed">Dual feed</option>
                      <option value="n_minus_one">N-1 requirement</option>
                    </select>
                  </label>
                  <label>
                    <span>Representative load shape</span>
                    <select
                      value={project.loadProfile}
                      onChange={(event) =>
                        updateProject({
                          loadProfile: event.target.value as FinderProject["loadProfile"],
                        })
                      }
                    >
                      <option value="flat">Continuous / flat</option>
                      <option value="business_hours">Business hours</option>
                      <option value="managed_charging">Managed charging</option>
                      <option value="flexible_process">Flexible process</option>
                    </select>
                  </label>
                  <label>
                    <span>Annual consumption GWh</span>
                    <input
                      type="number"
                      min="0"
                      max="20000"
                      step="1"
                      value={project.annualConsumptionGwh}
                      onChange={updateScenarioNumber("annualConsumptionGwh", 0, 20000)}
                    />
                  </label>
                  <label>
                    <span>Maximum interruption hours</span>
                    <input
                      type="number"
                      min="0"
                      max="8760"
                      step="1"
                      value={project.maxInterruptionHours}
                      onChange={updateScenarioNumber("maxInterruptionHours", 0, 8760)}
                    />
                  </label>
                  <label>
                    <span>Annual interruption limit</span>
                    <input
                      type="number"
                      min="0"
                      max="8760"
                      step="1"
                      value={project.annualInterruptionLimit}
                      onChange={updateScenarioNumber("annualInterruptionLimit", 0, 8760)}
                    />
                  </label>
                  <label>
                    <span>On-site generation MW</span>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="0.1"
                      value={project.onsiteGenerationMw}
                      onChange={updateScenarioNumber("onsiteGenerationMw", 0, 1000)}
                    />
                  </label>
                </div>
              </details>
            )}
            {isStorageProject(project.type) && search.study === "activation" && (
              <div className="finder-project-grid">
                <label>
                  <span>Battery MW</span>
                  <input
                    name="battery-power-mw"
                    type="number"
                    min="0"
                    step="0.1"
                    value={numericDrafts.batteryPowerMw}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-invalid={Boolean(fieldErrors.batteryPowerMw)}
                    onChange={(event) =>
                      commitNumber("batteryPowerMw", event.target.value, (value) => {
                        if (value != null) updateProject({ batteryPowerMw: value });
                      })
                    }
                  />
                  {fieldErrors.batteryPowerMw && (
                    <small className="finder-field-error">{fieldErrors.batteryPowerMw}</small>
                  )}
                </label>
                <label>
                  <span>Battery MWh</span>
                  <input
                    name="battery-energy-mwh"
                    type="number"
                    min="0"
                    step="0.1"
                    value={numericDrafts.batteryEnergyMwh}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-invalid={Boolean(fieldErrors.batteryEnergyMwh)}
                    onChange={(event) =>
                      commitNumber("batteryEnergyMwh", event.target.value, (value) => {
                        if (value != null) updateProject({ batteryEnergyMwh: value });
                      })
                    }
                  />
                  {fieldErrors.batteryEnergyMwh && (
                    <small className="finder-field-error">{fieldErrors.batteryEnergyMwh}</small>
                  )}
                </label>
                <label>
                  <span>Round-trip efficiency %</span>
                  <input
                    name="battery-round-trip-efficiency"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    inputMode="numeric"
                    autoComplete="off"
                    value={project.batteryRoundTripEfficiencyPct}
                    onChange={updateScenarioNumber("batteryRoundTripEfficiencyPct", 1, 100)}
                  />
                </label>
                <label>
                  <span>Battery reserve %</span>
                  <input
                    name="battery-reserve"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    inputMode="numeric"
                    autoComplete="off"
                    value={project.batteryReservePct}
                    onChange={updateScenarioNumber("batteryReservePct", 0, 100)}
                  />
                </label>
              </div>
            )}
            <p className="candidate-boundary">
              Click an empty point on the map or enter coordinates. The marker is a
              customer-declared site, not network evidence.
            </p>
            {project.latitude != null && project.longitude != null && (
              <button
                type="button"
                className="finder-clear-site"
                onClick={() => {
                  updateProject({ latitude: null, longitude: null });
                  setNumericDrafts((current) => ({ ...current, latitude: "", longitude: "" }));
                  setSelected(null);
                  setSelectedOpportunitySnapshot(null);
                  setComparisonOpen(false);
                  setInteractionNotice("Declared site cleared. Ranked pathways are hidden.");
                  void updateSearch({
                    lat: undefined,
                    lng: undefined,
                    candidate: undefined,
                    compare: undefined,
                  });
                }}
              >
                Clear declared site
              </button>
            )}
          </section>

          <section className="power-finder-filter-panel" aria-label="Search and filter map">
            <label className="power-finder-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Search nodes, operators, or identifiers</span>
              <input
                type="search"
                value={query}
                name="grid-search"
                autoComplete="off"
                onChange={(event) => void updateSearch({ q: event.target.value || undefined })}
                placeholder="Search node, operator, or ID…"
              />
            </label>
            <button
              type="button"
              className="finder-more-filters"
              aria-expanded={secondaryControlsOpen}
              aria-controls="finder-secondary-controls"
              onClick={() => setSecondaryControlsOpen((current) => !current)}
            >
              More Filters
            </button>
            <div
              id="finder-secondary-controls"
              className="power-finder-filter-grid"
              hidden={!secondaryControlsOpen}
            >
              <label className="power-finder-filter-wide">
                <span>Region</span>
                <select
                  name="region"
                  value={regionCode}
                  onChange={(event) =>
                    void updateSearch({
                      region: event.target.value as typeof regionCode,
                      candidate: undefined,
                      compare: undefined,
                    })
                  }
                >
                  {coverage.map((item) => (
                    <option key={item.regionCode} value={item.regionCode}>
                      {item.regionCode === "DE"
                        ? "Germany · accepted regional coverage"
                        : `${item.regionName} · ${item.status}`}
                    </option>
                  ))}
                </select>
                <small>{activeCoverage.regionName}</small>
              </label>
              <label>
                <span>Maximum distance</span>
                <select
                  name="maximum-distance"
                  value={maxDistanceKm}
                  onChange={(event) => {
                    const maxDistanceKm = Number(event.target.value) || 20;
                    updateProject({ maxDistanceKm });
                    void updateSearch({
                      distance: maxDistanceKm,
                      candidate: undefined,
                      compare: undefined,
                    });
                  }}
                >
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={20}>20 km</option>
                  <option value={50}>50 km</option>
                </select>
              </label>
              <label>
                <span>Minimum voltage</span>
                <select
                  name="minimum-voltage"
                  value={minimumVoltage}
                  onChange={(event) =>
                    void updateSearch({
                      voltage: Number(event.target.value) || undefined,
                      candidate: undefined,
                      compare: undefined,
                    })
                  }
                >
                  <option value={0}>Any / unknown</option>
                  <option value={20}>20+ kV</option>
                  <option value={110}>110+ kV</option>
                  <option value={220}>220+ kV</option>
                  <option value={380}>380+ kV</option>
                </select>
              </label>
              <label className="power-finder-filter-wide">
                <span>Transmission operator (TSO)</span>
                <select
                  name="transmission-operator"
                  value={selectedTso}
                  onChange={(event) => {
                    const operatorName = event.target.value;
                    void updateSearch({
                      operator: undefined,
                      tso: operatorName === "all" ? undefined : operatorName,
                      dso: undefined,
                      candidate: undefined,
                      compare: undefined,
                    });
                  }}
                >
                  <option value="all">All transmission operators</option>
                  {transmissionOperators.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {selectedTso !== "all" && <small>{selectedTso}</small>}
              </label>
              <label className="power-finder-filter-wide">
                <span>Distribution operator (DSO / other)</span>
                <select
                  name="distribution-operator"
                  value={selectedDso}
                  onChange={(event) => {
                    const operatorName = event.target.value;
                    void updateSearch({
                      operator: undefined,
                      dso: operatorName === "all" ? undefined : operatorName,
                      candidate: undefined,
                      compare: undefined,
                    });
                  }}
                >
                  <option value="all">All distribution operators</option>
                  {distributionOperators.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {selectedDso !== "all" && <small>{selectedDso}</small>}
              </label>
              <p className="operator-hierarchy-boundary power-finder-filter-wide">
                Region options intersect accepted mapped assets. DSO choices under a TSO use nearest
                mapped transmission context; this is a screening relationship, not an
                operator-confirmed control-area assignment.
              </p>
            </div>
            {mapMode !== "capacity" && (
              <p className="candidate-boundary" role="status">
                {activeCoverage.evidenceBoundary}
                {activeCoverage.status !== "accepted" &&
                  " This view may be empty until an accepted release is promoted."}
              </p>
            )}
          </section>

          <details className="finder-question-panel">
            <summary id="finder-question-title">Operator questions &amp; report</summary>
            <p className="finder-question-summary">
              Confirm the operator, connection point, delivery milestones and available flexibility.
            </p>
            <button
              type="button"
              className="secondary-button"
              disabled={
                !collection ||
                reportPreparing ||
                project.latitude == null ||
                project.longitude == null
              }
              onClick={async () => {
                if (!collection) return;
                setReportPreparing(true);
                setInteractionNotice("Preparing screening report…");
                try {
                  await downloadFinderReport(project, comparedCandidates, collection, {
                    enabled: mapMode === "capacity",
                    metric: capacityMetric,
                    requiredMw: requiredCapacityMw,
                    nodes: activeCapacityNodes,
                    evidenceBoundary:
                      capacitySource === "berlin_synthetic"
                        ? "Real mapped geography, synthetic electrical model. Not operator headroom, a reservation, or a connection offer."
                        : (capacityViewport?.evidenceBoundary ??
                          "Private results require an authorised workspace and completed electrical study."),
                  });
                  setInteractionNotice("Screening report downloaded.");
                } finally {
                  setReportPreparing(false);
                }
              }}
            >
              <Download aria-hidden="true" />
              <span>{reportPreparing ? "Preparing report…" : "Download screening report"}</span>
            </button>
          </details>

          <p className="sr-only" role="status" aria-live="polite">
            {interactionNotice}
          </p>

          <section
            className="capacity-opportunity-card"
            aria-labelledby="capacity-opportunity-title"
          >
            <label className="capacity-overlay-switch">
              <span>
                <strong id="capacity-opportunity-title">Capacity opportunities</strong>
                <small>Compare available results with your required power</small>
              </span>
              <input
                name="capacity-overlay"
                type="checkbox"
                role="switch"
                checked={mapMode === "capacity"}
                onChange={(event) => {
                  const isEnabled = event.target.checked;
                  setMapMode(isEnabled ? "capacity" : "voltage");
                  const nextSource = search.workspaceId ? "private" : "berlin_synthetic";
                  setCapacitySource(nextSource);
                  setInteractionNotice(
                    `Capacity opportunities ${isEnabled ? "enabled" : "disabled"}.`,
                  );
                  void updateSearch({
                    mapMode: isEnabled ? "capacity" : "voltage",
                    capacitySource: isEnabled ? nextSource : undefined,
                  });
                }}
              />
            </label>
            {mapMode === "capacity" && (
              <div className="capacity-opportunity-controls">
                <p className="capacity-source-status">
                  {capacitySource === "berlin_synthetic"
                    ? "Berlin synthetic calculation"
                    : "Reviewed private calculation"}
                </p>
                <div className="capacity-required-heading">
                  <label htmlFor="required-capacity-range">Required power</label>
                  <span>
                    {requiredCapacityMw.toLocaleString("en-GB", { maximumFractionDigits: 1 })} MW
                  </span>
                </div>
                <input
                  id="required-capacity-range"
                  name="required-capacity-range"
                  type="range"
                  min={1}
                  max={Math.min(1000, Math.max(100, Math.ceil((project.importMw * 3) / 25) * 25))}
                  step={1}
                  value={requiredCapacityMw}
                  aria-valuetext={`${requiredCapacityMw} megawatts required power`}
                  onChange={(event) => setRequiredCapacityMw(Number(event.target.value))}
                  onPointerUp={(event) =>
                    void updateSearch({ requiredMw: Number(event.currentTarget.value) })
                  }
                  onKeyUp={(event) =>
                    void updateSearch({ requiredMw: Number(event.currentTarget.value) })
                  }
                />
                <div className="capacity-control-row">
                  <label>
                    <span>Exact MW</span>
                    <input
                      type="number"
                      min={0.1}
                      max={1000}
                      step={0.1}
                      value={requiredCapacityMw}
                      onChange={(event) => {
                        const value = Math.min(
                          1000,
                          Math.max(0.1, Number(event.target.value) || 0.1),
                        );
                        setRequiredCapacityMw(value);
                        void updateSearch({ requiredMw: value });
                      }}
                    />
                  </label>
                  <label>
                    <span>Capacity basis</span>
                    <select
                      name="capacity-overlay-metric"
                      value={capacityMetric}
                      onChange={(event) => {
                        const value = event.target.value as CapacityMetric;
                        setCapacityMetric(value);
                        void updateSearch({ capacityMetric: value });
                      }}
                    >
                      {(Object.entries(capacityMetricLabels) as [CapacityMetric, string][]).map(
                        ([value, label]) => {
                          const unavailableInSynthetic =
                            capacitySource === "berlin_synthetic" &&
                            value !== "n0_import_mw" &&
                            value !== "firm_import_mw";
                          return (
                            <option key={value} value={value} disabled={unavailableInSynthetic}>
                              {label}
                              {unavailableInSynthetic ? " · private study required" : ""}
                            </option>
                          );
                        },
                      )}
                    </select>
                  </label>
                </div>
                {Math.abs(requiredCapacityMw - project.importMw) > 0.01 && (
                  <button
                    type="button"
                    className="capacity-reset-demand"
                    onClick={() => {
                      setRequiredCapacityMw(project.importMw);
                      void updateSearch({ requiredMw: undefined });
                    }}
                  >
                    Use project demand · {project.importMw} MW
                  </button>
                )}
                <p className="capacity-data-basis">
                  <ShieldCheck aria-hidden="true" />
                  {capacitySource === "berlin_synthetic"
                    ? "Berlin calculation pocket · real locations, synthetic electrical model"
                    : `Private reviewed results · ${capacityViewport?.access === "ready" ? "workspace connected" : "no coverage"}`}
                </p>
                {capacitySource === "berlin_synthetic" && (
                  <p className="capacity-overlay-empty">
                    Release 2 AI routing does not colour these nodes. Every displayed Berlin value
                    remains a Release 1 physics result.
                  </p>
                )}
                <p className="capacity-overlay-empty">
                  Move Required power to reclassify calculated nodes immediately: cyan meets the
                  threshold, dark blue is below it, and grey is outside this calculation pocket.
                </p>
                <div className="capacity-threshold-key" aria-label="Capacity map colour key">
                  <span>
                    <i className="is-meets" />
                    Meets {requiredCapacityMw} MW
                  </span>
                  <span>
                    <i className="is-activation" />
                    Activation pathway
                  </span>
                  <span>
                    <i className="is-below" />
                    Below requirement
                  </span>
                </div>
                <div className="capacity-fit-summary" role="status" aria-live="polite">
                  <span>
                    <b>{capacitySummary.meets}</b> meet
                  </span>
                  {capacitySource === "private" && (
                    <span>
                      <b>{capacitySummary.activation}</b> activation paths
                    </span>
                  )}
                  <span>
                    <b>{capacitySummary.below}</b> below
                  </span>
                  <span>
                    <b>{capacitySummary.unknown}</b> not calculated
                  </span>
                </div>
                {capacityState === "error" && (
                  <p className="capacity-overlay-empty">Capacity results could not be loaded.</p>
                )}
                {capacitySource === "private" &&
                  capacityState !== "error" &&
                  capacitySummary.meets === 0 &&
                  capacitySummary.activation === 0 && (
                    <p className="capacity-overlay-empty">
                      No reviewed capacity results cover this map. Unknown is not zero.
                    </p>
                  )}
              </div>
            )}
          </section>

          <details className="finder-layers-menu" suppressHydrationWarning>
            <summary>Map Layers</summary>
            <div className="power-finder-layer-list">
              {(Object.keys(kindLabels) as PowerFinderKind[]).map((kind) => (
                <label
                  key={kind}
                  title={`${kindLabels[kind]} is delivered from the accepted national tile release.`}
                >
                  <input
                    name={`layer-${kind}`}
                    type="checkbox"
                    checked={enabled[kind]}
                    disabled={false}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setEnabled((current) => ({ ...current, [kind]: checked }));
                      setInteractionNotice(
                        `${kindLabels[kind]} layer ${checked ? "enabled" : "disabled"}.`,
                      );
                    }}
                  />
                  <span>{kindLabels[kind]}</span>
                  <small>
                    {(() => {
                      if (!collection) return "—";
                      const total = collection.features.filter(
                        (feature) => feature.properties.kind === kind,
                      ).length;
                      const visible = visibleLayerCounts[kind];
                      if (visible > 0) return `${visible} visible`;
                      const availability = layerAvailability(collection, kind);
                      if (!availability.available) return "0 in current detail view";
                      if (total === 0) return "0 in view";
                      if (kind === "generation_asset" || kind === "storage_asset") {
                        return `${total} in view`;
                      }
                      return `${total} total`;
                    })()}
                  </small>
                </label>
              ))}
            </div>
            {(enabled.generation_asset || enabled.storage_asset) && (
              <p className="layer-visibility-note">
                Registered generation and storage show exact public coordinates from the accepted
                nationwide MaStR release. Zoom in for individual assets. If this view shows zero, no
                exact published coordinate is available here; locations are never invented.
              </p>
            )}
            {(enabled.line || enabled.industrial_site) &&
              visibleLayerCounts.line + visibleLayerCounts.industrial_site === 0 && (
                <p className="layer-visibility-note" role="status">
                  No enabled grid lines or industrial sites intersect the current map view. Pan or
                  zoom out to inspect the regional layer.
                </p>
              )}
          </details>

          <section className="power-finder-candidates">
            <header>
              <span>
                <h2>Candidate connection points</h2>
                <small role="status" aria-live="polite">
                  {project.latitude == null || project.longitude == null
                    ? "Choose a site to rank candidates"
                    : rankingState === "loading"
                      ? "Calculating…"
                      : `${candidates.length} candidate site-to-node matches`}
                </small>
              </span>
              <label>
                <span>Sort by</span>
                <select
                  name="candidate-sort"
                  value={candidateSort}
                  onChange={(event) =>
                    void updateSearch({ sort: event.target.value as CandidateSort })
                  }
                >
                  <option value="context">Best evidence match</option>
                  <option value="voltage">Highest voltage</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </header>
            {(project.latitude == null || project.longitude == null) && (
              <div className="finder-site-empty" role="status">
                <strong>No declared site yet</strong>
                <p>
                  Click an empty map location or enter coordinates above. GridPulse will then rank
                  mapped candidate connection points within your selected distance.
                </p>
              </div>
            )}
            {project.latitude != null && project.longitude != null && rankingState === "error" && (
              <p className="power-finder-no-results" role="status">
                Candidate ranking is unavailable. Change the map view or try again.
              </p>
            )}
            {candidateSelection.tsoFallback && (
              <p className="candidate-boundary" role="status">
                No nearby candidate has a confirmed {selectedTso} relationship. Showing valid
                distance, voltage and DSO matches; verify the TSO with the operator before relying
                on it.
              </p>
            )}
            {project.latitude != null &&
              project.longitude != null &&
              rankingState === "ready" &&
              candidates.length === 0 && (
                <p className="power-finder-no-results">
                  No candidate connection points are within {maxDistanceKm} km in this view.
                </p>
              )}
            {candidates.map((candidate, index) => {
              const capacityNode = activeCapacityNodes.find(
                (node) => node.publicNodeId === candidate.nodeId,
              );
              const capacityFit = classifyCapacityOpportunity(
                capacityNode,
                capacityMetric,
                requiredCapacityMw,
              );
              return (
                <button
                  type="button"
                  key={candidate.id}
                  data-candidate-id={candidate.id}
                  className={selectedOpportunity?.id === candidate.id ? "active" : ""}
                  aria-pressed={selectedOpportunity?.id === candidate.id}
                  onClick={() => {
                    const node =
                      opportunityNode(candidate, rankingCollection) ??
                      opportunityNode(candidate, collection);
                    const detailNode =
                      node ??
                      ({
                        type: "Feature",
                        id: candidate.nodeId,
                        geometry: {
                          type: "Point",
                          coordinates: [project.longitude ?? 0, project.latitude ?? 0],
                        },
                        properties: {
                          kind: "node",
                          name: candidate.nodeName,
                          operator: candidate.operator ?? undefined,
                          voltage_kv: candidate.voltageKv,
                          max_voltage_kv: Math.max(0, ...candidate.voltageKv),
                          evidence_class: "open_mapping",
                          capacity_state: "not_established",
                        },
                      } satisfies PowerFinderFeature);
                    setSelectedOpportunitySnapshot(candidate);
                    setSelected(detailNode);
                    if (detailNode.geometry.type === "Point") {
                      navigateMapToPoint(detailNode.geometry.coordinates as [number, number]);
                    }
                    setInteractionNotice(
                      `${candidate.nodeName} selected and highlighted on the map.`,
                    );
                    void updateSearch({ candidate: candidate.id }).then(() => {
                      setSelectedOpportunitySnapshot(candidate);
                      setSelected(detailNode);
                    });
                  }}
                  onMouseEnter={() => setPreviewCandidateId(candidate.id)}
                  onMouseLeave={() => setPreviewCandidateId(null)}
                  onFocus={() => setPreviewCandidateId(candidate.id)}
                  onBlur={() => setPreviewCandidateId(null)}
                  aria-label={`Show ${candidate.nodeName} on map, ${formatScore(candidate.screeningRank)}/100`}
                >
                  <span className="candidate-rank">{index + 1}</span>
                  <span>
                    <b>{candidate.siteName}</b>
                    <small>
                      {candidate.nodeName} · {distanceFormatter.format(candidate.distanceKm)} km
                    </small>
                    <span className="candidate-badges">
                      <i data-fit={candidate.voltageFit}>
                        {candidate.voltageFit === "compatible"
                          ? "Voltage aligned"
                          : candidate.voltageFit === "conditional"
                            ? "Voltage differs"
                            : "Voltage unknown"}
                      </i>
                      <i data-confidence={candidate.confidence}>
                        {candidate.confidence === "high"
                          ? "High evidence"
                          : candidate.confidence === "medium"
                            ? "Medium evidence"
                            : "Limited evidence"}
                      </i>
                      {candidate.capacityScenario && (
                        <i data-confidence="synthetic">
                          demo import {formatMw(candidate.capacityScenario.firmImportEnvelopeMw)}
                        </i>
                      )}
                      {candidate.networkScenario && (
                        <i data-confidence="synthetic">
                          synthetic security{" "}
                          {formatMw(candidate.networkScenario.selectedSecurityLimitMw)}
                        </i>
                      )}
                      <strong>{formatScore(candidate.screeningRank)}/100</strong>
                    </span>
                    {mapMode === "capacity" && (
                      <span className={`candidate-capacity-fit is-${capacityFit.fit}`}>
                        {capacityFit.fit === "meets" &&
                          `${capacityFit.valueMw?.toLocaleString("en-GB", { maximumFractionDigits: 1 })} MW · meets ${requiredCapacityMw} MW`}
                        {capacityFit.fit === "activation" &&
                          `${capacityFit.valueMw?.toLocaleString("en-GB", { maximumFractionDigits: 1 })} MW firm · ${capacityFit.alternative} pathway`}
                        {capacityFit.fit === "below" &&
                          `${capacityFit.valueMw?.toLocaleString("en-GB", { maximumFractionDigits: 1 })} MW · below requirement`}
                        {capacityFit.fit === "stale" && "Recalculation required"}
                        {capacityFit.fit === "unknown" && "Capacity not calculated"}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {ranking && project.latitude != null && project.longitude != null && (
              <>
                <details className="finder-ranking-method">
                  <summary>How this ranking works</summary>
                  <p>
                    The evidence match combines mapped voltage, straight-line distance, source
                    authority, operator attribution and freshness. Requested MW is preserved for the
                    screening brief, but it does not change this public-evidence ranking because
                    available grid capacity is not established.
                  </p>
                </details>
                <p className="candidate-boundary">{ranking.evidenceBoundary}</p>
              </>
            )}
          </section>

          {collection && (
            <footer className="power-finder-source">
              <Database aria-hidden="true" />
              <div>
                <strong>{collection.metadata.publisher}</strong>
                <span>
                  {collection.metadata.freshness} · {collection.metadata.record_count} records ·{" "}
                  {dataMode === "database"
                    ? "authenticated database query"
                    : dataMode === "public_database"
                      ? "live public viewport"
                      : "accepted static fallback"}
                </span>
                <small>{collection.metadata.attribution}</small>
              </div>
            </footer>
          )}
        </section>

        <section className="power-finder-stage">
          <button
            type="button"
            className="power-finder-sidebar-toggle"
            aria-label={sidebarOpen ? "Hide map controls" : "Show map controls"}
            aria-expanded={sidebarOpen}
            onClick={() => {
              setSidebarOpen((current) => !current);
              window.setTimeout(() => window.dispatchEvent(new Event("resize")), 200);
            }}
          >
            {sidebarOpen ? (
              <PanelLeftClose aria-hidden="true" />
            ) : (
              <PanelLeftOpen aria-hidden="true" />
            )}
            <span>{sidebarOpen ? "Hide panel" : "Show panel"}</span>
          </button>
          {error && <div className="power-finder-error">{error}</div>}
          {!visibleCollection && !error && (
            <div className="power-finder-loading">Loading map context…</div>
          )}
          {visibleCollection && (
            <PowerFinderMap
              collection={visibleCollection}
              enabledLayers={enabled}
              selectedFeature={selected}
              previewFeature={previewFeature}
              mapMode={mapMode}
              capacityNodes={activeCapacityNodes}
              capacityCoverage={
                capacitySource === "berlin_synthetic" ? (berlinCapacity?.coverage ?? null) : null
              }
              capacityMetric={capacityMetric}
              requiredCapacityMw={requiredCapacityMw}
              viewportTarget={viewportTarget}
              navigationTarget={mapNavigationTarget}
              onSelect={(feature) => {
                setSelected(feature);
                if (feature.properties.kind === "node") {
                  const matchingOpportunity = highestRankedOpportunityForNode(
                    candidates,
                    String(feature.id),
                  );
                  if (matchingOpportunity) {
                    setSelectedOpportunitySnapshot(matchingOpportunity);
                    const pathwayCount = candidates.filter(
                      (candidate) => candidate.nodeId === String(feature.id),
                    ).length;
                    setInteractionNotice(
                      pathwayCount > 1
                        ? `${feature.properties.name} selected. Showing the highest-ranked of ${pathwayCount} pathways using this node.`
                        : `${feature.properties.name} selected and matched to its ranked candidate.`,
                    );
                    void updateSearch({ candidate: matchingOpportunity.id });
                    return;
                  }
                  setInteractionNotice(
                    `${feature.properties.name} is outside the current ranked shortlist. Change the filters or project location to evaluate it.`,
                  );
                } else {
                  setInteractionNotice(`${feature.properties.name} selected on the map.`);
                }
                void updateSearch({ candidate: undefined });
              }}
              onViewportChange={setBounds}
              projectSite={
                project.longitude != null && project.latitude != null
                  ? [project.longitude, project.latitude]
                  : null
              }
              onSitePlacement={([longitude, latitude]) => {
                const containingRegion = coverage.find((item) => {
                  if (item.regionCode === "DE") return false;
                  const [west, south, east, north] = item.bounds;
                  return (
                    longitude >= west && longitude <= east && latitude >= south && latitude <= north
                  );
                });
                updateProject({ longitude, latitude });
                setNumericDrafts((current) => ({
                  ...current,
                  longitude: longitude.toFixed(6),
                  latitude: latitude.toFixed(6),
                }));
                setFieldErrors((current) => ({
                  ...current,
                  longitude: undefined,
                  latitude: undefined,
                }));
                setInteractionNotice(
                  "Site changed. Candidate selection and comparison were reset.",
                );
                void updateSearch({
                  lng: longitude,
                  lat: latitude,
                  region: containingRegion?.regionCode as typeof regionCode | undefined,
                  candidate: undefined,
                  compare: undefined,
                });
              }}
              onVisibleLayerCounts={setVisibleLayerCounts}
            />
          )}
          <div className="power-finder-legend" aria-label="Map legend">
            <strong>
              {mapMode === "capacity"
                ? `${capacityMetricLabels[capacityMetric]} · MW`
                : mapMode === "voltage"
                  ? "Voltage context"
                  : "Evidence authority"}
            </strong>
            {mapMode === "capacity" ? (
              <>
                <span>
                  <i className="legend-capacity-high" /> Meets {requiredCapacityMw} MW
                </span>
                <span>
                  <i className="legend-capacity-activation" /> Alternative pathway
                </span>
                <span>
                  <i className="legend-capacity-low" /> Below {requiredCapacityMw} MW
                </span>
                <span>
                  <i className="legend-capacity-stale" /> Stale · recalculate
                </span>
                <small>
                  {capacitySource === "berlin_synthetic"
                    ? "Berlin pocket · real mapped nodes, synthetic 110 kV model; not operator headroom"
                    : capacityViewport?.nodes[0]
                      ? `${capacityViewport.nodes[0].scenarioLabel} · ${capacityViewport.nodes[0].modelVersion}`
                      : "No reviewed results in this workspace view"}
                </small>
              </>
            ) : (
              <>
                <span>
                  <i className="legend-node" /> Grid node · orange marker, voltage outline
                </span>
                {GRID_VOLTAGE_CLASSES.map((voltageClass) => (
                  <span key={voltageClass.id}>
                    <i
                      className="legend-voltage-line"
                      style={{ borderColor: voltageClass.color }}
                    />
                    {voltageClass.label}
                  </span>
                ))}
                <span>
                  <i className="legend-site" /> Industrial land
                </span>
                <span>
                  <i className="legend-generation" style={{ background: "#facc15" }} /> Solar
                </span>
                <span>
                  <i className="legend-generation" style={{ background: "#38bdf8" }} /> Wind
                </span>
                <span>
                  <i className="legend-generation" style={{ background: "#22c55e" }} /> Biomass
                </span>
                <span>
                  <i className="legend-generation" style={{ background: "#06b6d4" }} /> Hydro
                </span>
                <span>
                  <i className="legend-generation" style={{ background: "#f97316" }} />
                  Geothermal
                </span>
                <span>
                  <i className="legend-generation" style={{ background: "#f472b6" }} /> Nuclear
                </span>
                <span>
                  <i className="legend-generation" style={{ background: "#a78bfa" }} /> Gas
                </span>
                <span>
                  <i className="legend-generation" style={{ background: "#ef4444" }} /> Coal, oil
                  &amp; other fossil
                </span>
                <span>
                  <i className="legend-generation" style={{ background: "#94a3b8" }} /> Other /
                  unknown
                </span>
                <span>
                  <i className="legend-storage" /> Registered storage
                </span>
              </>
            )}
          </div>

          {activationOpen && selectedOpportunity && (
            <Suspense
              fallback={<div className="activation-study-loading">Loading Activation Study…</div>}
            >
              <ActivationStudyPanel
                project={project}
                candidate={selectedOpportunity}
                registeredStudy={c1Study}
                referenceCapacity={null}
                tab={activationTab}
                onTabChange={(studyTab) => void updateSearch({ studyTab })}
                onClose={() => void updateSearch({ study: undefined, studyTab: undefined })}
                onStartAssessment={
                  productCapabilities.workspace ? startPrivateAssessment : undefined
                }
              />
            </Suspense>
          )}

          {comparedCandidates.length > 0 && (
            <section
              className={`candidate-comparison ${comparisonOpen ? "open" : ""}`}
              aria-label="Candidate comparison"
            >
              <header>
                <span>
                  <GitCompareArrows aria-hidden="true" />
                  <b>
                    Compare {comparedCandidates.length}{" "}
                    {comparedCandidates.length === 1 ? "Candidate" : "Candidates"}
                  </b>
                </span>
                <button
                  type="button"
                  aria-expanded={comparisonOpen}
                  onClick={() => setComparisonOpen((current) => !current)}
                >
                  {comparisonOpen ? "Close" : "Open comparison"}
                </button>
              </header>
              {comparisonOpen && (
                <div>
                  {comparedCandidates.map((candidate) => (
                    <article key={candidate.id}>
                      <strong>{candidate.siteName}</strong>
                      <span>{candidate.nodeName}</span>
                      <button
                        type="button"
                        className="candidate-comparison-remove"
                        aria-label={`Remove ${candidate.nodeName} from comparison`}
                        onClick={() => {
                          const next = removeComparisonCandidate(comparisonIds, candidate.id);
                          setInteractionNotice("Candidate removed from comparison.");
                          void updateSearch({ compare: serializeComparison(next) });
                        }}
                      >
                        Remove
                      </button>
                      <dl>
                        <div>
                          <dt>Rank</dt>
                          <dd>{formatScore(candidate.screeningRank)}/100</dd>
                        </div>
                        <div>
                          <dt>Distance</dt>
                          <dd>{candidate.distanceKm} km</dd>
                        </div>
                        <div>
                          <dt>Voltage screen</dt>
                          <dd>{voltageFitLabels[candidate.voltageFit]}</dd>
                        </div>
                        <div>
                          <dt>Evidence</dt>
                          <dd>{candidate.confidence} completeness</dd>
                        </div>
                        <div>
                          <dt>Operator</dt>
                          <dd>
                            {candidate.operator
                              ? canonicalOperatorName(candidate.operator)
                              : "Confirm"}
                          </dd>
                        </div>
                        <div>
                          <dt>Import / export</dt>
                          <dd>
                            {project.importMw} / {project.exportMw} MW
                          </dd>
                        </div>
                        <div>
                          <dt>Evidence gaps</dt>
                          <dd>{candidate.missingEvidence.length}</dd>
                        </div>
                        <div>
                          <dt>Activation strategy</dt>
                          <dd>
                            {comparedActivation.get(candidate.id)?.recommendedOption?.title ??
                              "Not established"}
                          </dd>
                        </div>
                        <div>
                          <dt>Initial / eventual benchmark</dt>
                          <dd>
                            {(() => {
                              const option = comparedActivation.get(
                                candidate.id,
                              )?.recommendedOption;
                              return option
                                ? `${option.initialImportMw.toFixed(1)} / ${option.eventualImportMw.toFixed(1)} MW`
                                : "—";
                            })()}
                          </dd>
                        </div>
                        <div>
                          <dt>Representative restrictions</dt>
                          <dd>
                            {comparedActivation.get(candidate.id)?.recommendedOption?.analysis
                              ?.restrictedHours ?? "—"}{" "}
                            h
                          </dd>
                        </div>
                        <div>
                          <dt>Primary validation blocker</dt>
                          <dd>
                            {comparedActivation.get(candidate.id)?.recommendedOption?.nextAction ??
                              "Confirm operator evidence"}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              )}
              {comparisonOpen && (
                <button
                  type="button"
                  className="candidate-comparison-clear"
                  onClick={() => {
                    if (!window.confirm("Clear every candidate from this comparison?")) return;
                    setComparisonOpen(false);
                    setInteractionNotice("Candidate comparison cleared.");
                    void updateSearch({ compare: undefined });
                  }}
                >
                  Clear comparison
                </button>
              )}
            </section>
          )}

          <aside className={`power-finder-detail ${selectedDetailFeature ? "open" : ""}`}>
            {selectedDetailFeature ? (
              ((selected) => (
                <>
                  <button
                    type="button"
                    className="detail-close"
                    onClick={async () => {
                      await updateSearch({ candidate: undefined });
                      setSelectedOpportunitySnapshot(null);
                      setSelected(null);
                    }}
                    aria-label="Close detail"
                  >
                    ×
                  </button>
                  <div className="detail-sticky-header">
                    <p className="context-label">
                      {selectedOpportunity && selected.properties.kind === "node"
                        ? "Selected candidate connection point"
                        : kindLabels[selected.properties.kind]}
                    </p>
                    <h2>{selected.properties.name}</h2>
                    <p>{featureSummary(selected)}</p>
                    {selectedOpportunity && (
                      <p className="candidate-boundary">
                        {selectedOpportunity.siteName} → {selectedOpportunity.nodeName} ·{" "}
                        {distanceFormatter.format(selectedOpportunity.distanceKm)} km straight-line
                        distance
                      </p>
                    )}
                    {selected.properties.kind === "node" && selectedCapacity && (
                      <span className="candidate-truth-status">
                        {selectedCapacityOpportunity.valueMw == null
                          ? `${capacityMetricLabels[capacityMetric]} · ${selectedCapacityOpportunity.fit === "stale" ? "recalculation required" : "not calculated"}`
                          : `${capacityMetricLabels[capacityMetric]} · ${selectedCapacityOpportunity.valueMw} MW · ${selectedCapacity.validationState.replaceAll("_", " ")}`}
                      </span>
                    )}
                  </div>
                  {selectedOpportunity && selectedNodePathways.length > 1 && (
                    <p className="node-pathway-notice" role="status">
                      {selectedNodePathways.length} candidate matches use this node. The
                      highest-ranked match is selected from the current list.
                    </p>
                  )}
                  {selectedCapacity &&
                    selectedCapacityOpportunity.fit !== "stale" &&
                    selectedCapacity.validationState !== "failed" && (
                      <section
                        className="finder-panel-card finder-panel-card--study"
                        aria-label="Calculated capacity result"
                      >
                        <header>
                          <span>Calculated capacity</span>
                          <b>{selectedCapacity.validationState.replaceAll("_", " ")}</b>
                        </header>
                        <p>
                          Node-specific electrical result for model {selectedCapacity.modelVersion},{" "}
                          {selectedCapacity.scenarioLabel},{" "}
                          {selectedCapacity.securityCase.replace("_", "-").toUpperCase()}.
                        </p>
                        <dl>
                          <div>
                            <dt>Firm import</dt>
                            <dd>{selectedCapacity.firmCapacityMw ?? "—"} MW</dd>
                          </div>
                          <div>
                            <dt>Flexible import</dt>
                            <dd>{selectedCapacity.flexibleCapacityMw ?? "—"} MW</dd>
                          </div>
                          <div>
                            <dt>BESS-assisted</dt>
                            <dd>{selectedCapacity.bessAssistedCapacityMw ?? "—"} MW</dd>
                          </div>
                          <div>
                            <dt>Staged initial / eventual</dt>
                            <dd>
                              {selectedCapacity.stagedInitialCapacityMw ?? "—"} /{" "}
                              {selectedCapacity.eventualCapacityMw ?? "—"} MW
                            </dd>
                          </div>
                          <div>
                            <dt>Restricted hours</dt>
                            <dd>{selectedCapacity.restrictedHours ?? "—"} h/year</dd>
                          </div>
                          <div>
                            <dt>Binding constraint</dt>
                            <dd>
                              {selectedCapacity.bindingCategory?.replaceAll("_", " ") ??
                                "Not recorded"}
                            </dd>
                          </div>
                        </dl>
                        <small>
                          Calculated {new Date(selectedCapacity.calculatedAt).toLocaleString()} ·
                          not a connection offer or capacity reservation.
                        </small>
                      </section>
                    )}
                  {selected.properties.kind === "node" ? (
                    <>
                      <section
                        className="candidate-fact-section"
                        aria-labelledby="candidate-known-title"
                      >
                        <h3 id="candidate-known-title">Connection Context</h3>
                        <dl>
                          <div>
                            <dt>Mapped Asset</dt>
                            <dd>{selected.properties.name}</dd>
                          </div>
                          <div>
                            <dt>Mapped Voltage</dt>
                            <dd>
                              {selected.properties.voltage_kv?.length
                                ? `${Math.max(...selected.properties.voltage_kv)} kV`
                                : "Unknown"}
                            </dd>
                          </div>
                          {selectedOpportunity && (
                            <div>
                              <dt>Distance From Site</dt>
                              <dd>
                                {distanceFormatter.format(selectedOpportunity.distanceKm)} km
                                straight-line
                              </dd>
                            </div>
                          )}
                          <div>
                            <dt>Likely Network Operator</dt>
                            <dd>
                              {selected.properties.operator
                                ? `${canonicalOperatorName(selected.properties.operator)} · confirmation required`
                                : "Confirmation required"}
                            </dd>
                          </div>
                          <div>
                            <dt>Infrastructure Source</dt>
                            <dd>
                              {selected.properties.evidence_class === "open_mapping"
                                ? "OpenStreetMap-derived mapping"
                                : selected.properties.evidence_class.replaceAll("_", " ")}
                            </dd>
                          </div>
                        </dl>
                      </section>
                      {selected.properties.planning_status &&
                        selected.properties.planning_status !== "screening_only" && (
                          <section className="candidate-fact-section">
                            <h3>Published Development Context</h3>
                            <p>{selected.properties.planning_status.replaceAll("_", " ")}</p>
                          </section>
                        )}
                    </>
                  ) : (
                    <dl>
                      <div>
                        <dt>Evidence Source</dt>
                        <dd>{selected.properties.evidence_class.replaceAll("_", " ")}</dd>
                      </div>
                      <div>
                        <dt>Technology</dt>
                        <dd>{selected.properties.technology ?? "Not published"}</dd>
                      </div>
                      <div>
                        <dt>Registered Power</dt>
                        <dd>
                          {selected.properties.net_capacity_mw != null
                            ? `${selected.properties.net_capacity_mw} MW`
                            : "Not published"}
                        </dd>
                      </div>
                      {selected.properties.kind === "storage_asset" && (
                        <div>
                          <dt>Registered Energy</dt>
                          <dd>
                            {selected.properties.storage_energy_mwh != null
                              ? `${selected.properties.storage_energy_mwh} MWh`
                              : "Not published"}
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}
                  {(selected.properties.kind === "generation_asset" ||
                    selected.properties.kind === "storage_asset") && (
                    <p className="candidate-boundary">
                      Registered asset data provides local market context. It does not establish
                      grid headroom or connection availability.
                    </p>
                  )}
                  {selectedOpportunity && (
                    <section className="candidate-intelligence" aria-label="Candidate intelligence">
                      <header>
                        <span>
                          <strong>{formatScore(selectedOpportunity.screeningRank)}/100</strong>
                          <small>candidate priority score</small>
                        </span>
                        <b>{selectedOpportunity.siteName}</b>
                      </header>
                      <section
                        className="candidate-outcome"
                        aria-labelledby="candidate-outcome-title"
                      >
                        <div>
                          <span id="candidate-outcome-title">Shortlist Position</span>
                          <strong>
                            {selectedOpportunity.screeningRank >= 70
                              ? "High-priority candidate"
                              : selectedOpportunity.screeningRank >= 40
                                ? "Worth comparing"
                                : "More evidence needed"}
                          </strong>
                          <small>
                            Based on mapped voltage, proximity, operator context &amp; evidence
                            coverage.
                          </small>
                        </div>
                      </section>
                      <section
                        className="candidate-key-drivers"
                        aria-labelledby="key-drivers-title"
                      >
                        <h3 id="key-drivers-title">Why This Candidate Was Shortlisted</h3>
                        <ul>
                          <li>{voltageFitLabels[selectedOpportunity.voltageFit]}.</li>
                          <li>
                            {distanceFormatter.format(selectedOpportunity.distanceKm)} km
                            straight-line proximity to the declared site.
                          </li>
                          <li>
                            {selectedOpportunity.operator
                              ? `Mapped operator tag: ${canonicalOperatorName(selectedOpportunity.operator)}.`
                              : "Responsible operator requires confirmation."}
                          </li>
                        </ul>
                      </section>
                      <dl>
                        <div>
                          <dt>Distance</dt>
                          <dd>{selectedOpportunity.distanceKm} km straight-line</dd>
                        </div>
                        <div>
                          <dt>Voltage screen</dt>
                          <dd>{voltageFitLabels[selectedOpportunity.voltageFit]}</dd>
                        </div>
                        <div>
                          <dt>Evidence completeness</dt>
                          <dd>{selectedOpportunity.confidence}</dd>
                        </div>
                      </dl>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          if (comparisonIds.includes(selectedOpportunity.id)) {
                            const next = removeComparisonCandidate(
                              comparisonIds,
                              selectedOpportunity.id,
                            );
                            setInteractionNotice("Candidate removed from comparison.");
                            void updateSearch({ compare: serializeComparison(next) });
                            return;
                          }
                          const result = addComparisonCandidate(
                            comparisonIds,
                            selectedOpportunity.id,
                          );
                          if (result.limitReached) {
                            setInteractionNotice("You can compare up to 5 candidates.");
                            return;
                          }
                          setInteractionNotice(
                            `Candidate added. ${result.ids.length} of 5 comparison slots used.`,
                          );
                          setComparisonOpen(true);
                          void updateSearch({ compare: serializeComparison(result.ids) });
                        }}
                      >
                        <GitCompareArrows aria-hidden="true" />
                        {comparisonIds.includes(selectedOpportunity.id)
                          ? "Remove From Comparison"
                          : "Add to Comparison"}
                      </button>
                    </section>
                  )}
                  {selected.properties.kind === "node" && c1Study?.c3?.available && (
                    <section className="finder-panel-card finder-panel-card--study">
                      <header>
                        <span>Security &amp; Flexibility Study</span>
                        <b>Operator model linked</b>
                      </header>
                      <p>
                        This result is linked to an operator-reviewed model for the selected node.
                      </p>
                      <dl>
                        <div>
                          <dt>Firm Import</dt>
                          <dd>
                            {c1Study.c3.security?.import_capacity?.values
                              ?.firm_import_capacity_mw ?? "—"}{" "}
                            MW
                          </dd>
                        </div>
                        <div>
                          <dt>Firm Export</dt>
                          <dd>
                            {c1Study.c3.security?.export_capacity?.values
                              ?.firm_export_capacity_mw ?? "—"}{" "}
                            MW
                          </dd>
                        </div>
                        <div>
                          <dt>Contingencies Assessed</dt>
                          <dd>{c1Study.c3.security?.contingency_coverage?.assessed_count ?? 0}</dd>
                        </div>
                        <div>
                          <dt>Constrained Hours</dt>
                          <dd>
                            {c1Study.c3.flexibilitySummary?.constrained_hours?.toLocaleString() ??
                              "—"}
                          </dd>
                        </div>
                      </dl>
                    </section>
                  )}
                  {productCapabilities.workspace && selected.properties.kind === "node" && (
                    <section
                      className="power-finder-operator-evidence"
                      aria-label="Official operator evidence"
                    >
                      <header>
                        <ShieldCheck aria-hidden="true" />
                        <span>
                          <b>Operator evidence</b>
                          <small>
                            {operatorEvidence?.match_state === "accepted_node_evidence"
                              ? "Reviewed node match"
                              : operatorEvidence?.match_state === "operator_context_only"
                                ? "Operator-level context"
                                : "No reviewed node evidence"}
                          </small>
                        </span>
                      </header>
                      {operatorEvidenceState === "loading" && <p>Checking accepted evidence…</p>}
                      {operatorEvidenceState === "unavailable" && (
                        <p>Evidence service is temporarily unavailable.</p>
                      )}
                      {operatorEvidenceState === "idle" && dataMode === "published_artifact" && (
                        <p>Sign in to the live evidence release to inspect operator sources.</p>
                      )}
                      {operatorEvidenceState === "ready" &&
                        (operatorEvidence?.items.length ? (
                          <ul>
                            {operatorEvidence.items.map((item) => (
                              <li key={`${item.scope}-${item.url}`}>
                                <span>
                                  {item.scope === "node_match" && (
                                    <CheckCircle2 aria-label="Reviewed node match" />
                                  )}
                                  <a href={item.url} target="_blank" rel="noreferrer">
                                    {item.title} <ExternalLink aria-hidden="true" />
                                  </a>
                                </span>
                                <small>
                                  {item.scope === "node_match"
                                    ? item.rationale
                                    : item.legal_boundary}
                                </small>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>
                            No official publication is linked to this mapped node. Capacity remains
                            unknown until the responsible operator responds.
                          </p>
                        ))}
                      <footer>
                        Operator-level pages explain process or network context. They do not
                        establish capacity at this node.
                      </footer>
                    </section>
                  )}
                  {productCapabilities.workspace && coordinates && (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={saveStatus === "saving"}
                      onClick={() => {
                        setSaveStatus("saving");
                        void savePowerFinderCandidate(
                          selected,
                          selectedOpportunity,
                          requiredImportMw,
                        )
                          .then((id) => {
                            setShortlistId(id);
                            setSaveStatus("saved");
                            return navigate({
                              to: "/assessments/new",
                              search: {
                                shortlistId: id,
                                name: selectedOpportunity?.siteName ?? selected.properties.name,
                                projectType: "large_load",
                                importMw: requiredImportMw,
                                latitude: coordinates[1],
                                longitude: coordinates[0],
                                federalState: "Brandenburg",
                                challenge: selectedOpportunity
                                  ? `${selectedOpportunity.siteName} screened against ${selectedOpportunity.nodeName} at ${distanceFormatter.format(selectedOpportunity.distanceKm)} km. Rank ${formatScore(selectedOpportunity.screeningRank)}/100 reflects context only; capacity, feasibility, cost, and timing require operator confirmation.`
                                  : `Screening candidate ${selected.id}; capacity and operator responsibility require confirmation.`,
                              },
                            });
                          })
                          .catch(() => setSaveStatus("error"));
                      }}
                    >
                      <MapPin />{" "}
                      {saveStatus === "saving" ? "Saving map context…" : "Start private assessment"}
                    </button>
                  )}
                  {productCapabilities.workspace &&
                    ["node", "industrial_site"].includes(selected.properties.kind) && (
                      <button
                        type="button"
                        className="secondary-button power-finder-save"
                        disabled={saveStatus === "saving" || saveStatus === "saved"}
                        onClick={() => {
                          setSaveStatus("saving");
                          void savePowerFinderCandidate(
                            selected,
                            selectedOpportunity,
                            requiredImportMw,
                          )
                            .then((id) => {
                              setShortlistId(id);
                              setSaveStatus("saved");
                            })
                            .catch(() => setSaveStatus("error"));
                        }}
                      >
                        <BookmarkPlus aria-hidden="true" />
                        {saveStatus === "saving"
                          ? "Saving…"
                          : saveStatus === "saved"
                            ? "Saved to shortlist"
                            : saveStatus === "error"
                              ? "Try saving again"
                              : shortlistId
                                ? "Saved to shortlist"
                                : "Save candidate"}
                      </button>
                    )}
                  {productCapabilities.workspace && !coordinates && (
                    <p className="detail-help">
                      Select a node to start an assessment. Industrial land remains site context
                      only.
                    </p>
                  )}
                  {productCapabilities.workspace &&
                    selectedOpportunity &&
                    selected.properties.kind === "node" && (
                      <button
                        type="button"
                        className="primary-button power-finder-activation-cta"
                        onClick={() =>
                          void updateSearch({ study: "activation", studyTab: "overview" })
                        }
                      >
                        <Zap aria-hidden="true" /> Assess activation pathways
                      </button>
                    )}
                </>
              ))(selectedDetailFeature)
            ) : (
              <div className="power-finder-empty-detail">
                <Network />
                <h2>Select a node or site</h2>
                <p>Inspect its voltage, source boundary, operator context and screening score.</p>
              </div>
            )}
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
