import { Link } from "@tanstack/react-router";
import { solutions, type SolutionId } from "@/config/solutions";

export function SolutionPreview({
  id,
  view = "overview",
}: {
  id: SolutionId;
  view?: "overview" | "workloads" | "battery";
}) {
  const solution = solutions.find((item) => item.id === id)!;
  const planning = id === "planning";
  return (
    <figure className="solution-preview">
      <Link to={solution.to} aria-label={`Explore ${solution.label} workspace`}>
        <picture>
          <source
            media="(max-width: 600px)"
            srcSet={
              planning
                ? "/landing/power-finder-product-mobile.jpg"
                : "/landing/facility-operations-mobile.webp"
            }
          />
          <img
            src={
              planning
                ? "/landing/power-finder-product.jpg"
                : `/landing/facility-operations-${view}.webp`
            }
            width={1600}
            height={planning ? 980 : 1100}
            loading="lazy"
            decoding="async"
            alt={
              planning
                ? "Power Finder in dark mode showing mapped grid infrastructure and site investigation context"
                : `Facility Operations ${view}: real MILP calculation using synthetic inputs, with modelled results`
            }
          />
        </picture>
      </Link>
      <figcaption>
        {planning
          ? "Mapped German grid context · screening, not confirmed capacity"
          : "Synthetic example · real MILP calculation · modelled results, no equipment control"}
      </figcaption>
    </figure>
  );
}
