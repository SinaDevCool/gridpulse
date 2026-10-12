import type { ProductMode } from "@/config/product-mode";

export type ProductCapability = "finder" | "workspace" | "connect" | "operate";
export type UnavailableBehavior = "explain" | "hide";

export const primaryWorkspaceDestinationIds = ["sites", "finder", "operations"] as const;
const primaryWorkspaceDestinations = new Set<string>(primaryWorkspaceDestinationIds);

export const workspaceLinks = [
  {
    id: "sites",
    label: "Sites",
    detail: "Site portfolio",
    group: "planning",
    to: "/portfolio",
    capability: "finder",
    unavailableBehavior: "explain",
  },
  {
    id: "finder",
    label: "Power Finder",
    detail: "Connection screening",
    group: "planning",
    to: "/power-finder",
    capability: "finder",
    unavailableBehavior: "explain",
  },
  {
    id: "operations",
    label: "Operations",
    detail: "Facility power",
    group: "operations",
    to: "/operations",
    capability: "finder",
    unavailableBehavior: "explain",
  },
  {
    id: "planner",
    label: "Planner",
    detail: "Energy & flexibility",
    group: "planning",
    to: "/data-centre-planner",
    capability: "finder",
    unavailableBehavior: "explain",
  },
  {
    id: "activation",
    label: "Activation",
    detail: "Connection pathway",
    group: "planning",
    to: "/activation",
    capability: "connect",
    unavailableBehavior: "explain",
  },
  {
    id: "evidence",
    label: "Evidence",
    detail: "Claims & sources",
    group: "planning",
    to: "/evidence",
    capability: "finder",
    unavailableBehavior: "explain",
  },
  {
    id: "reports",
    label: "Reports",
    detail: "Decision packages",
    group: "planning",
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

export function workspaceDestinationsForMode(mode: ProductMode) {
  return workspaceLinks.filter(
    (item) =>
      primaryWorkspaceDestinations.has(item.id) &&
      (capabilityAvailable(item.capability, mode) || item.unavailableBehavior === "explain"),
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
