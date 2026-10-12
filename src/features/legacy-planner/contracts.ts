import { type DataCentreDesignResult } from "@/features/data-centre-planner/model";

import { type RzregPerformanceRecord } from "@/features/data-centre-planner/benchmark";

import {
calculateStorageLcos,
type StorageLcosInput,
} from "@/features/data-centre-planner/storage-lcos";

import { TECHNOLOGIES } from "./presentation";

export type Artifact = {
  metadata: { record_count: number; validation_warning_count: number };
  records: RzregPerformanceRecord[];
};

export type View = "overview" | "energy" | "benchmark" | "flexibility" | "economics" | "canonical";

export type Project = {
  name: string;
  location: string;
  it: number | null;
  pue: number | null;
  load: number | null;
  ref: number | null;
  erf: number | null;
  wue: number | null;
  firm: number | null;
  price: number | null;
};

export type TechId = (typeof TECHNOLOGIES)[number]["id"];

export type TechnologyScenario = {
  inputs: StorageLcosInput;
  evidenceType: "customer_assumption" | "supplier_quote" | "published_reference";
  sourceReference: string;
  priceYear: number | null;
};

export type TechnologyScenarios = Record<TechId, TechnologyScenario>;

export type Design = DataCentreDesignResult | null;

export type FlexResult = NonNullable<ReturnType<typeof calculateStorageLcos>> | null;
