import { type StorageLcosInput } from "@/features/data-centre-planner/storage-lcos";

import { type Project,type TechnologyScenarios } from "./contracts";

export const emptyProject: Project = {
  name: "",
  location: "",
  it: null,
  pue: null,
  load: null,
  ref: null,
  erf: null,
  wue: null,
  firm: null,
  price: null,
};

export const illustrativeProject: Project = {
  name: "Bremen Edge Campus · illustrative",
  location: "Bremen, Germany",
  it: 120,
  pue: 1.28,
  load: 72,
  ref: 45,
  erf: 18,
  wue: 0.35,
  firm: 120,
  price: 108,
};

const emptyEconomics: StorageLcosInput = {
  powerMw: null,
  durationHours: null,
  cyclesPerYear: null,
  roundTripEfficiencyPct: null,
  capexPowerEurPerKw: null,
  capexEnergyEurPerKwh: null,
  fixedOpexEurPerKwYear: null,
  variableOpexEurPerMwh: null,
  chargingEnergyPriceEurPerMwh: null,
  discountRatePct: null,
  economicLifeYears: null,
};

export const TECHNOLOGIES = [
  {
    id: "li-ion",
    name: "Lithium-ion battery",
    duration: "Short to medium duration",
    maturity: "Commercial",
    site: "Modular; fire and safety design required",
    source: "US DOE storage assessment",
  },
  {
    id: "flow",
    name: "Vanadium flow battery",
    duration: "Multi-hour",
    maturity: "Commercial / scaling",
    site: "Larger footprint and electrolyte systems",
    source: "US DOE storage assessment",
  },
  {
    id: "caes",
    name: "Compressed-air storage",
    duration: "Long duration",
    maturity: "Site-dependent",
    site: "Suitable geology or engineered pressure vessels",
    source: "US DOE CAES assessment",
  },
  {
    id: "liquid-air",
    name: "Liquid-air storage",
    duration: "5 h in the cited UK project",
    maturity: "Demonstration / early commercial",
    site: "Industrial plant footprint and heat integration",
    source: "UK Government Storage at Scale",
  },
  {
    id: "co2",
    name: "CO₂ battery",
    duration: "10 h or longer in the cited project",
    maturity: "First-of-a-kind demonstration",
    site: "Large thermodynamic storage plant",
    source: "European Commission / EIB",
  },
  {
    id: "pumped-hydro",
    name: "Pumped-storage hydro",
    duration: "Long duration",
    maturity: "Mature",
    site: "Exceptional topography, water and permits",
    source: "US DOE storage assessment",
  },
  {
    id: "hydrogen",
    name: "Hydrogen storage",
    duration: "Long / seasonal potential",
    maturity: "Application-dependent",
    site: "Conversion losses, safety and infrastructure",
    source: "US DOE storage assessment",
  },
  {
    id: "thermal",
    name: "Thermal storage",
    duration: "Application-dependent",
    maturity: "Commercial in suitable heat/cooling uses",
    site: "Does not replace electrical UPS for all loads",
    source: "US DOE storage assessment",
  },
] as const;

export const emptyScenarios = Object.fromEntries(
  TECHNOLOGIES.map((technology) => [
    technology.id,
    {
      inputs: { ...emptyEconomics },
      evidenceType: "customer_assumption",
      sourceReference: "",
      priceYear: null,
    },
  ]),
) as TechnologyScenarios;

export const STORAGE_KEY = "gridpulse:data-centre-analytics:v2";

export const fmt = new Intl.NumberFormat("en-DE", { maximumFractionDigits: 1 });

export const eur = new Intl.NumberFormat("en-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
