import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/workspaces")({
  beforeLoad: () => {
    throw redirect({ to: "/portfolio", search: { view: "pipeline" }, replace: true });
  },
});
