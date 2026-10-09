import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/operations/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/operations", search: { view: "overview" }, replace: true });
  },
  component: () => null,
});
