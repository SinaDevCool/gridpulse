import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { calculateCapacityScenario } from "@/features/power-finder/capacity-scenario";
import { defaultFinderProject, type FinderProject } from "@/features/power-finder/finder-project";
import type { CandidateOpportunity } from "@/features/power-finder/candidate-intelligence";
import { calculateReleaseBNetwork } from "@/features/power-finder/release-b-network";

const projectSchema = z
  .object({
    name: z.string().max(160),
    type: z.enum([
      "data_centre",
      "industrial_load",
      "battery_storage",
      "co_location",
      "electrolyser",
      "charging_hub",
    ]),
    importMw: z.number().min(0.1).max(1000),
    ultimateImportMw: z.number().min(0.1).max(1000),
    exportMw: z.number().min(0).max(1000),
    minimumFirmMw: z.number().min(0).max(1000),
    flexibleLoadMw: z.number().min(0).max(1000),
    targetEnergisationYear: z.number().int().min(2026).max(2050),
    preferredVoltageKv: z.number().min(0).max(500).nullable(),
    redundancy: z.enum(["single_feed", "dual_feed", "n_minus_one"]),
    loadProfile: z.enum(["flat", "business_hours", "managed_charging", "flexible_process"]),
    annualConsumptionGwh: z.number().min(0).max(20_000),
    maxInterruptionHours: z.number().min(0).max(8760),
    annualInterruptionLimit: z.number().int().min(0).max(8760),
    batteryPowerMw: z.number().min(0).max(1000),
    batteryEnergyMwh: z.number().min(0).max(20_000),
    batteryRoundTripEfficiencyPct: z.number().min(1).max(100),
    batteryReservePct: z.number().min(0).max(100),
    onsiteGenerationMw: z.number().min(0).max(1000),
  })
  .passthrough();

const candidateSchema = z
  .object({
    id: z.string().min(1).max(300),
    nodeId: z.string().min(1).max(200),
    voltageKv: z.array(z.number().min(0).max(500)).max(8),
    distanceKm: z.number().min(0).max(1000),
    contextScore: z.number().min(0).max(100),
    evidenceScore: z.number().min(0).max(100),
  })
  .passthrough();

const requestSchema = z.object({
  project: projectSchema,
  candidates: z.array(candidateSchema).min(1).max(25),
});

export const Route = createFileRoute("/api/power-finder/scenario")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const experimentalEnabled =
          (env as { PUBLIC_FINDER_EXPERIMENTAL_MODE?: string }).PUBLIC_FINDER_EXPERIMENTAL_MODE ===
          "true";
        if (!experimentalEnabled) {
          return Response.json(
            {
              error: "Experimental demonstration models are disabled for the public MVP.",
              validatedStudyAvailable: false,
            },
            { status: 404, headers: { "cache-control": "no-store" } },
          );
        }
        const limiter = (
          env as {
            PUBLIC_FINDER_RATE_LIMITER?: {
              limit(input: { key: string }): Promise<{ success: boolean }>;
            };
          }
        ).PUBLIC_FINDER_RATE_LIMITER;
        if (limiter) {
          const allowed = await limiter.limit({
            key: `finder-scenario:${new URL(request.url).hostname}`,
          });
          if (!allowed.success) {
            return Response.json(
              { error: "Too many scenario requests. Please try again shortly." },
              { status: 429, headers: { "retry-after": "60" } },
            );
          }
        }
        if (Number(request.headers.get("content-length") ?? 0) > 96_000) {
          return Response.json({ error: "Scenario request is too large." }, { status: 413 });
        }
        let input: z.infer<typeof requestSchema>;
        try {
          input = requestSchema.parse(await request.json());
        } catch (error) {
          return Response.json(
            {
              error: "Scenario request is invalid.",
              fields:
                error instanceof z.ZodError
                  ? error.issues
                      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                      .filter(Boolean)
                  : [],
            },
            { status: 400 },
          );
        }
        const project = { ...defaultFinderProject, ...input.project } as FinderProject;
        const scenarios = input.candidates.map((candidate) => {
          const typedCandidate = candidate as CandidateOpportunity;
          const capacityScenario = calculateCapacityScenario(project, typedCandidate);
          return {
            capacityScenario,
            networkScenario: calculateReleaseBNetwork(project, typedCandidate, capacityScenario),
          };
        });
        return Response.json(
          {
            scenarios,
            evidenceStatus: "synthetic",
            validationStatus: "unvalidated_reference_model",
            notForConnectionDecision: true,
          },
          {
            headers: {
              "cache-control": "no-store",
              "x-gridpulse-evidence-status": "synthetic",
            },
          },
        );
      },
    },
  },
});
