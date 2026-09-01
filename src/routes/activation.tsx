import { createFileRoute, redirect } from "@tanstack/react-router";
import { OutcomeProjectIndex } from "@/components/product/OutcomeProjectIndex";
import { productCapabilities } from "@/config/product-mode";

export const Route = createFileRoute("/activation")({
  beforeLoad: () => { if (!productCapabilities.workspace) throw redirect({ to: "/power-finder", replace: true }); },
  component: ActivationIndex,
});

function ActivationIndex() {
  return <OutcomeProjectIndex eyebrow="Connection pathway" title="Activation studies" description="Turn a screened site into a governed connection strategy, with explicit evidence gaps and operator-confirmation gates." destination="/activation/$id" />;
}
