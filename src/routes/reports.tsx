import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/reports")({
  validateSearch: z.object({
    view: z.string().optional(),
    decision: z.enum(["all", "unreviewed", "advance", "hold", "reject"]).optional(),
    operator: z.string().optional(),
    risk: z.enum(["all", "blocked", "deadline", "operator_confirmed"]).optional(),
    sort: z.string().optional(),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/portfolio",
      search: {
        view: search.view === "qualification" ? "readiness" : "decisions",
        decision: search.decision,
        operator: search.operator,
        risk: search.risk,
        sort: search.sort === "name" || search.sort === "mw" ? search.sort : undefined,
      },
      replace: true,
    });
  },
});
