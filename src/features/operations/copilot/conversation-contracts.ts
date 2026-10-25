import { z } from "zod";
import { factSchema, receiptSchema } from "./contracts";

export const CHAT_VERSION = "operations-conversation-v1" as const;
export const navigationSchema = z.object({ view: z.enum(["overview", "compute", "power"]),
  timestamp: z.string().datetime({ offset: true }).nullable(), workloadId: z.string().max(200).nullable() }).strict();
export type CopilotNavigation = z.infer<typeof navigationSchema>;
export const conversationRequestSchema = z.object({ version: z.literal(CHAT_VERSION), jobId: z.string().uuid(),
  resultFingerprint: z.string().regex(/^[a-f0-9]{64}$/), question: z.string().trim().min(1).max(1000),
  history: z.array(z.string().trim().min(1).max(1000)).max(6),
  context: navigationSchema,
}).strict();
export type ConversationRequest = z.infer<typeof conversationRequestSchema>;
export const intents = ["summary", "power", "interval", "workload", "battery", "checks", "constraints",
  "why", "what_if", "definition", "unsupported", "clarify"] as const;
export const definitions = ["none", "soc", "terminal", "milp", "reserve", "power_energy", "optimality"] as const;
export const querySchema = z.object({ intent: z.enum(intents), workloadId: z.string().max(200).nullable(),
  start: z.string().datetime({ offset: true }).nullable(), end: z.string().datetime({ offset: true }).nullable(),
  focus: z.enum(["selected", "peak", "minimum_soc", "first_charge", "first_discharge"]),
  definition: z.enum(definitions),
}).strict();
export type ConversationQuery = z.infer<typeof querySchema>;
export const conversationResponseSchema = z.object({ version: z.literal(CHAT_VERSION),
  kind: z.enum(["answer", "clarification", "requires_calculation", "unsupported"]),
  basis: z.enum(["model_evidence", "general_explanation", "no_calculation"]),
  resolvedQuery: querySchema,
  question: z.string().max(1000), blocks: z.array(z.string().max(2000)).min(1).max(64),
  evidence: z.array(factSchema).max(160), navigation: z.array(navigationSchema).max(8),
  receipt: receiptSchema, generatedAt: z.string().datetime({ offset: true }), model: z.string().max(100),
  limitations: z.array(z.string().max(500)).max(8),
}).strict().refine(value => new Set(value.evidence.map(fact => fact.id)).size === value.evidence.length,
  "Duplicate evidence");
export type ConversationAnswer = z.infer<typeof conversationResponseSchema>;
