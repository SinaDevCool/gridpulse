import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

export const Route = createFileRoute("/api/operations/capabilities")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            schemaVersion: "gridpulse-operations-capabilities-v1",
            persistence: {
              configured: Boolean(
                (env as { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string })
                  .SUPABASE_URL &&
                (env as { SUPABASE_SERVICE_ROLE_KEY?: string }).SUPABASE_SERVICE_ROLE_KEY,
              ),
              provider: "Supabase PostgreSQL",
            },
            connectors: [
              {
                id: "nvidia_dcgm",
                label: "NVIDIA DCGM / Prometheus",
                status: "not_connected",
                transport: "Prometheus metrics",
                evidence: ["GPU power", "energy", "utilisation", "temperature", "throttling"],
              },
              {
                id: "kueue",
                label: "Kubernetes / Kueue",
                status: "not_connected",
                transport: "Kubernetes watch API",
                evidence: ["workloads", "priority", "GPU requests", "admission state"],
              },
              {
                id: "slurm",
                label: "Slurm",
                status: "not_connected",
                transport: "slurmrestd / sacct JSON",
                evidence: ["jobs", "GPU allocation", "timing", "accounting"],
              },
              {
                id: "facility_meter",
                label: "Facility meter",
                status: "not_connected",
                transport: "OpenEMS, Modbus, OPC-UA or CSV",
                evidence: ["facility grid import"],
              },
              {
                id: "bms",
                label: "Battery BMS / PCS",
                status: "not_connected",
                transport: "SunSpec, OpenEMS, Modbus or CSV",
                evidence: ["SOC", "power", "availability", "alarms"],
              },
            ],
            controlMode: "read_only",
          },
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
