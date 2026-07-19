export const PROJECT_ROLES = [
  "viewer",
  "customer_contributor",
  "technical_reviewer",
  "commercial_reviewer",
  "grid_expert",
  "workspace_admin",
] as const;

export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const EDITING_ROLES = new Set<ProjectRole>(PROJECT_ROLES.slice(1));
export const SIGNING_ROLES = new Set<ProjectRole>([
  "technical_reviewer",
  "commercial_reviewer",
  "grid_expert",
  "workspace_admin",
]);

export function mayEdit(role: string): role is ProjectRole {
  return EDITING_ROLES.has(role as ProjectRole);
}

export function maySignAs(actorRole: string, requestedRole: string) {
  return actorRole === requestedRole && SIGNING_ROLES.has(actorRole as ProjectRole);
}

export function roleLabel(role: string) {
  return (
    (
      {
        viewer: "Read only",
        customer_contributor: "Customer contributor",
        technical_reviewer: "Technical reviewer",
        commercial_reviewer: "Commercial reviewer",
        grid_expert: "Grid expert",
        workspace_admin: "Workspace administrator",
      } as Record<string, string>
    )[role] ?? role
  );
}
