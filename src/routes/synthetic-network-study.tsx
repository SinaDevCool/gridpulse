import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const legacySearch = z.object({
  project: z.enum(["data_centre", "bess", "electrolyser", "industrial_load"]).optional().catch(undefined),
  mw: z.coerce.number().min(0.1).max(1000).optional().catch(undefined),
  exportMw: z.coerce.number().min(0).max(1000).optional().catch(undefined),
  batteryMw: z.coerce.number().min(0).max(1000).optional().catch(undefined),
  batteryMwh: z.coerce.number().min(0).max(20_000).optional().catch(undefined),
  flexibleMw: z.coerce.number().min(0).max(1000).optional().catch(undefined),
});

export const Route = createFileRoute("/synthetic-network-study")({
  validateSearch: legacySearch,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/power-finder",
      replace: true,
      search: {
        projectType: search.project === "bess" ? "battery_storage" : (search.project ?? "data_centre"),
        mw: search.mw,
        exportMw: search.exportMw,
        flexibleMw: search.flexibleMw,
        batteryMw: search.batteryMw,
        batteryMwh: search.batteryMwh,
      },
    });
  },
});
