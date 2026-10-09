import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { z } from "zod";
import {
  OperationsPayloadError,
  operationsFingerprint,
  readOperationsJson,
} from "@/lib/operations-request";
import {
  operationsAssessmentRequestSchema,
  runOperationsAssessment,
} from "@/features/operations/operations-service";

export const Route = createFileRoute("/api/operations/assess")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (Number(request.headers.get("content-length") ?? 0) > 8_000_000)
          return Response.json(
            { error: "Operations assessment payload is too large." },
            { status: 413 },
          );
        const limiter = (
          env as {
            PUBLIC_FINDER_RATE_LIMITER?: {
              limit(input: { key: string }): Promise<{ success: boolean }>;
            };
          }
        ).PUBLIC_FINDER_RATE_LIMITER;
        if (limiter) {
          const permitted = await limiter.limit({
            key: `operations-assess:${request.headers.get("cf-connecting-ip") ?? "local"}`,
          });
          if (!permitted.success)
            return Response.json(
              { error: "Too many Operations assessments. Try again shortly." },
              { status: 429, headers: { "retry-after": "60" } },
            );
        }
        try {
          const input = operationsAssessmentRequestSchema.parse(
            await readOperationsJson(request, 8_000_000),
          );
          const inputFingerprint = await operationsFingerprint(input);
          return Response.json(
            {
              ...runOperationsAssessment(input),
              assessmentId: crypto.randomUUID(),
              inputFingerprint,
            },
            {
              headers: { "cache-control": "no-store", "x-gridpulse-control-mode": "read-only" },
            },
          );
        } catch (error) {
          if (error instanceof OperationsPayloadError)
            return Response.json(
              { error: error.message },
              { status: error.status, headers: { "cache-control": "no-store" } },
            );
          if (!(error instanceof z.ZodError)) {
            console.error(
              JSON.stringify({
                event: "operations_assessment_failed",
                requestId: crypto.randomUUID(),
              }),
            );
            return Response.json(
              { error: "Operations assessment could not be calculated." },
              { status: 500, headers: { "cache-control": "no-store" } },
            );
          }
          return Response.json(
            {
              error: "Operations evidence is invalid.",
              fields:
                error instanceof z.ZodError
                  ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                  : [],
            },
            { status: 400, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
