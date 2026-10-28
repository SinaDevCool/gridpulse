import { guidanceSchema } from "./guidance-contracts";
import { z } from "zod";
import { factSchema, receiptSchema } from "./contracts";
import { proposalSelectionSchema, reviewedProposalSchema } from "./experiment-proposal";

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
export const analysisPlanSchema = z.object({ queries: z.array(querySchema).min(1).max(4), proposal: proposalSelectionSchema.nullable().optional() }).strict();
export type AnalysisPlan = z.infer<typeof analysisPlanSchema>;
export type ConversationQuery = z.infer<typeof querySchema>;
export const conversationRequestSchema = z.object({ version: z.literal(CHAT_VERSION), jobId: z.string().uuid(),
  resultFingerprint: z.string().regex(/^[a-f0-9]{64}$/), question: z.string().trim().min(1).max(1000),
  history: z.array(z.string().trim().min(1).max(1000)).max(6),
  context: navigationSchema,
  previousQueries: z.array(querySchema).max(3).optional(),
  transcript: z.array(z.object({ question: z.string().max(1000), answer: z.string().max(3000) }).strict()).max(4).optional(),
  experimentJobId: z.string().uuid().optional(),
}).strict();
export type ConversationRequest = z.infer<typeof conversationRequestSchema>;
export const conversationResponseSchema = z.object({ version: z.literal(CHAT_VERSION),
  kind: z.enum(["answer", "clarification", "requires_calculation", "unsupported"]),
  basis: z.enum(["model_evidence", "general_explanation", "no_calculation"]),
  presentation: z.enum(["grounded_conversation", "checked_fallback"]).optional(),
  findings: z.array(z.object({id:z.string().max(120),checkedText:z.string().max(2000),kind:z.enum(["answer","evidence","guidance"]),
    contextFactIds:z.array(z.string()).max(160),guidanceRefs:z.array(z.object({id:z.string(),revision:z.string()}).strict()).max(4),
    mandatory:z.literal(true),resultFingerprint:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).max(64).optional(),
  analysisCapabilities:z.object({uncertainty:z.boolean(),chronologicalShadow:z.boolean()}).strict().optional(),
  knowledgeFingerprint:z.string().regex(/^[a-f0-9]{64}$/).optional(), knowledgeVersion:z.string().max(100).optional(),
  verifiedFindingIds: z.array(z.string().max(120)).max(64).optional(),
  paragraphSources: z.array(z.object({ factIds: z.array(z.string()).max(16), guidanceIds: z.array(z.string()).max(4) }).strict()).max(4).optional(),
  resolvedQuery: querySchema,
  resolvedQueries: z.array(querySchema).min(1).max(4).optional(),
  coverage: z.array(z.object({ intent: z.enum(intents), status: z.enum(["answer", "clarification", "requires_calculation", "unsupported"]) }).strict()).max(4).optional(),
    question: z.string().max(1000), blocks: z.array(z.string().max(2000)).min(1).max(64),
    investigation: z.object({
      status: z.literal("requires_independent_validation"),
      gaps:z.array(z.object({id:z.string(),scope:z.string(),status:z.enum(["unknown","missing","supplied","quality_failed","reviewed"]),reason:z.string().max(400),actionId:z.enum(["review_measurements","review_battery","review_workloads"]),question:z.string().max(200)}).strict()).max(8).optional(),
      hypotheses: z.array(z.object({ label: z.string().max(200), status: z.literal("untested"),
        test: z.string().max(400) }).strict()).max(6),
      requiredEvidence: z.array(z.string().max(300)).max(8),
      nextAction: z.string().max(500),
    }).strict().optional(),
  evidence: z.array(factSchema).max(160), navigation: z.array(navigationSchema).max(8),
  guidance: z.array(guidanceSchema).max(4).optional(),
  receipt: receiptSchema, generatedAt: z.string().datetime({ offset: true }), model: z.string().max(100),
  limitations: z.array(z.string().max(500)).max(8),
  proposal: reviewedProposalSchema.optional(),
  proposalClarification: z.string().max(500).optional(),
  capabilities: z.array(z.object({ intent: z.enum(intents), execution: z.string(), available: z.boolean(),
    limitations: z.string(), unavailableReason: z.string().nullable() }).strict()).max(24).optional(),
}).strict().refine(value => new Set(value.evidence.map(fact => fact.id)).size === value.evidence.length,
  "Duplicate evidence").refine(value => !value.findings || value.findings.every(f => f.resultFingerprint===value.receipt.resultFingerprint && f.contextFactIds.every(id=>value.evidence.some(fact=>fact.id===id)) && f.guidanceRefs.every(ref=>value.guidance?.some(g=>g.id===ref.id && (g.revision??g.version)===ref.revision))), "Invalid checked finding provenance").refine(value => !value.paragraphSources || value.paragraphSources.length === value.blocks.length &&
    value.paragraphSources.every(paragraph => paragraph.factIds.every(id => value.evidence.some(fact => fact.id === id)) &&
      paragraph.guidanceIds.every(id => value.guidance?.some(item => item.id === id))), "Invalid paragraph sources");
export type ConversationAnswer = z.infer<typeof conversationResponseSchema>;
