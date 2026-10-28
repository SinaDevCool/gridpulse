import { z } from "zod";
export const guidanceSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    text: z.string().max(1000),
    source: z.string().url(),
    version: z.string(),
    section: z.string().optional(),
    applicability: z.string().optional(),
    license: z.string().optional(),
    reviewStatus: z.literal("editorial_guidance").optional(),
    sourceId: z.string().optional(),
    sourceContentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    revision: z.string().optional(),
    reviewedAt: z.string().optional(),
    reviewer: z.string().optional(),
    requiredInputs: z.array(z.string()).max(12).optional(),
    supportedActionIds: z.array(z.string()).max(8).optional(),
    pdfPages: z.array(z.number().int().positive()).max(20).optional(),
    evidenceClass: z.literal("report_guidance").optional(),
    excludedUses: z.array(z.string()).max(8).optional(),
  })
  .strict();
