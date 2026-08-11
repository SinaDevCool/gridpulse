import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/operations")({
  beforeLoad: () => {
    throw redirect({ to: "/power-finder", replace: true });
  },
});
