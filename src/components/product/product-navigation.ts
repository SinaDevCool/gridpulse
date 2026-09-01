export const workspaceLinks = [
  { label: "Sites", detail: "Portfolio decisions", to: "/portfolio" },
  { label: "Power Finder", detail: "Grid hypotheses", to: "/power-finder" },
  { label: "Planner", detail: "Energy & flexibility", to: "/data-centre-planner" },
  { label: "Activation", detail: "Connection pathway", to: "/activation" },
  { label: "Operations", detail: "Shadow delivery", to: "/operations" },
  { label: "Evidence", detail: "Claims & sources", to: "/evidence" },
  { label: "Reports", detail: "Decision packages", to: "/reports" },
] as const;

export type WorkspaceDestination = (typeof workspaceLinks)[number]["to"];

const siteWorkspacePaths = ["/portfolio", "/workspaces", "/capacity-dossiers/"] as const;

export function isWorkspaceDestinationActive(pathname: string, to: WorkspaceDestination) {
  if (to === "/portfolio") {
    return siteWorkspacePaths.some((path) =>
      path.endsWith("/") ? pathname.startsWith(path) : pathname === path || pathname.startsWith(`${path}/`),
    );
  }
  if (to === "/evidence") return pathname === to || pathname.startsWith("/evidence-");
  return pathname === to || pathname.startsWith(`${to}/`);
}
