import { createFileRoute } from "@tanstack/react-router";
import { OutcomeProjectIndex } from "@/components/product/OutcomeProjectIndex";
import { productCapabilities } from "@/config/product-mode";
import { CapabilityPrerequisite } from "@/components/product/CapabilityPrerequisite";

export const Route = createFileRoute("/activation")({
  component: ActivationIndex,
});

function ActivationIndex() {
  if (!productCapabilities.connect)
    return (
      <CapabilityPrerequisite
        eyebrow="Connection pathway"
        title="Activation prerequisites"
        description="Move from screening evidence to a governed connection strategy when project and operator workflows are enabled."
        requirements={[
          "A saved site and requested import",
          "A completed screening brief",
          "A reviewed connection strategy",
          "Operator workflow access",
        ]}
      />
    );
  return (
    <OutcomeProjectIndex
      eyebrow="Connection pathway"
      title="Activation studies"
      description="Turn a screened site into a governed connection strategy, with explicit evidence gaps and operator-confirmation gates."
      destination="/activation/$id"
    />
  );
}
