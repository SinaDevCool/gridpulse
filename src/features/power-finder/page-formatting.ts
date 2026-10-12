import { type PowerFinderKind } from "@/features/power-finder/fixture-data";

import { type PowerFinderBounds } from "@/features/power-finder/data-source";

export const kindLabels: Record<PowerFinderKind, string> = {
  node: "Grid nodes",
  line: "Grid corridors",
  industrial_site: "Industrial sites",
  generation_asset: "Generation",
  storage_asset: "Storage",
};

export const initialBounds: PowerFinderBounds = {
  west: 12.9,
  south: 52.1,
  east: 13.8,
  north: 52.6,
};

export type CandidateSort = "context" | "voltage" | "name";

export const distanceFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

const scoreFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

const mwFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function formatScore(value: number) {
  return scoreFormatter.format(value);
}

export function formatMw(value: number) {
  return `${mwFormatter.format(value)} MW`;
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (reason) => {
        window.clearTimeout(timeout);
        reject(reason);
      },
    );
  });
}
