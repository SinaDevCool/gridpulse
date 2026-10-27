import { z } from "zod";
import { factSchema, receiptSchema } from "./contracts";

export const CHAT_VERSION = "operations-conversation-v2" as const;
export const navigationSchema = z.object({ view: z.enum(["overview", "compute", "power"]),
  timestamp: z.string().datetime({ offset: true }).nullable(), workloadId: z.string().max(200).nullable() }).strict();
export type CopilotNavigation = z.infer<typeof navigationSchema>;
export const intents = ["summary", "power", "interval", "workload", "battery", "checks", "constraints",
  "why", "what_if", "definition", "unsupported", "clarify", "readiness", "knowledge", "experiment", "accounting", "workloads", "diagnosis"] as const;
export const definitions = ["none", "soc", "terminal", "milp", "reserve", "power_energy", "optimality", "pue"] as const;
export const querySchema = z.object({ intent: z.enum(intents), workloadId: z.string().max(200).nullable(),
  start: z.string().datetime({ offset: true }).nullable(), end: z.string().datetime({ offset: true }).nullable(),
  focus: z.enum(["selected", "peak", "minimum_soc", "first_charge", "first_discharge"]),
  definition: z.enum(definitions),
}).strict();
export const analysisPlanSchema = z.object({ queries: z.array(querySchema).min(1).max(4) }).strict();
export type AnalysisPlan = z.infer<typeof analysisPlanSchema>;
export type ConversationQuery = z.infer<typeof querySchema>;
export const conversationRequestSchema = z.object({ version: z.literal(CHAT_VERSION), jobId: z.string().uuid(),
  resultFingerprint: z.string().regex(/^[a-f0-9]{64}$/), question: z.string().trim().min(1).max(1000),
  history: z.array(z.string().trim().min(1).max(1000)).max(6),
  context: navigationSchema,
  previousQueries: z.array(querySchema).max(3).optional(),
  experimentJobId: z.string().uuid().optional(),
}).strict();
export type ConversationRequest = z.infer<typeof conversationRequestSchema>;
export const conversationResponseSchema = z.object({ version: z.literal(CHAT_VERSION),
  kind: z.enum(["answer", "clarification", "requires_calculation", "unsupported"]),
  basis: z.enum(["model_evidence", "general_explanation", "no_calculation"]),
  resolvedQuery: querySchema,
  resolvedQueries: z.array(querySchema).min(1).max(4).optional(),
  coverage: z.array(z.object({ intent: z.enum(intents), status: z.enum(["answer", "clarification", "requires_calculation", "unsupported"]) }).strict()).max(4).optional(),
    question: z.string().max(1000), blocks: z.array(z.string().max(2000)).min(1).max(64),
    investigation: z.object({
      status: z.literal("requires_independent_validation"),
      hypotheses: z.array(z.object({ label: z.string().max(200), status: z.literal("untested"),
        test: z.string().max(400) }).strict()).max(6),
      requiredEvidence: z.array(z.string().max(300)).max(8),
      nextAction: z.string().max(500),
    }).strict().optional(),
  evidence: z.array(factSchema).max(160), navigation: z.array(navigationSchema).max(8),
  guidance: z.array(z.object({ id: z.string(), title: z.string(), text: z.string().max(1000), source: z.string().url(),
    version: z.string(), section: z.string().optional(), applicability: z.string().optional(), license: z.string().optional(), reviewStatus: z.literal("editorial_guidance").optional(),
    sourceId: z.string().optional(), pdfPages: z.array(z.number().int().positive()).max(20).optional(),
    evidenceClass: z.literal("report_guidance").optional(), excludedUses: z.array(z.string()).max(8).optional() }).strict()).max(4).optional(),
  receipt: receiptSchema, generatedAt: z.string().datetime({ offset: true }), model: z.string().max(100),
  limitations: z.array(z.string().max(500)).max(8),
}).strict().refine(value => new Set(value.evidence.map(fact => fact.id)).size === value.evidence.length,
  "Duplicate evidence");
export type ConversationAnswer = z.infer<typeof conversationResponseSchema>;
