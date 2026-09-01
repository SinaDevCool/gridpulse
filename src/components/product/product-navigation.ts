import type { ProductMode } from "@/config/product-mode";

export type ProductCapability = "finder" | "workspace" | "connect" | "operate";
export type UnavailableBehavior = "explain" | "hide";

export const workspaceLinks = [
  {
    id: "sites",
    label: "Sites",
    detail: "Portfolio decisions",
    to: "/portfolio",
    capability: "finder",
    unavailableBehavior: "explain",
  },
  {
    id: "finder",
    label: "Power Finder",
    detail: "Grid hypotheses",
    to: "/power-finder",
    capability: "finder",
    unavailableBehavior: "explain",
  },
  {
    id: "constraints",
    label: "Constraints",
    detail: "Exposure & evidence",
    to: "/constraint-explorer",
    capability: "finder",
    unavailableBehavior: "explain",
  },
  {
    id: "planner",
    label: "Planner",
    detail: "Energy & flexibility",
    to: "/data-centre-planner",
    capability: "finder",
    unavailableBehavior: "explain",
  },
  {
    id: "activation",
    label: "Activation",
    detail: "Connection pathway",
    to: "/activation",
    capability: "connect",
    unavailableBehavior: "explain",
  },
  {
    id: "operations",
    label: "Operations",
    detail: "Shadow delivery",
    to: "/operations",
    capability: "operate",
    unavailableBehavior: "explain",
  },
  {
    id: "evidence",
    label: "Evidence",
    detail: "Claims & sources",
    to: "/evidence",
    capability: "finder",
    unavailableBehavior: "explain",
  },
  {
    id: "reports",
    label: "Reports",
    detail: "Decision packages",
    to: "/reports",
    capability: "finder",
    unavailableBehavior: "explain",
  },
] as const;

export type WorkspaceDestination = (typeof workspaceLinks)[number]["to"];

export function capabilityAvailable(capability: ProductCapability, mode: ProductMode) {
  if (capability === "finder") return true;
  if (capability === "workspace") return mode !== "finder";
  if (capability === "connect") return mode === "connect" || mode === "full";
  return mode === "full";
}

export function workspaceLinksForMode(mode: ProductMode) {
  return workspaceLinks.filter(
    (item) => capabilityAvailable(item.capability, mode) || item.unavailableBehavior === "explain",
  );
}

const siteWorkspacePaths = ["/portfolio", "/workspaces", "/capacity-dossiers/"] as const;

export function isWorkspaceDestinationActive(pathname: string, to: WorkspaceDestination) {
  if (to === "/portfolio") {
    return siteWorkspacePaths.some((path) =>
      path.endsWith("/")
        ? pathname.startsWith(path)
        : pathname === path || pathname.startsWith(`${path}/`),
    );
  }
  if (to === "/evidence") return pathname === to || pathname.startsWith("/evidence-");
  return pathname === to || pathname.startsWith(`${to}/`);
}
