import { useRouterState } from "@tanstack/react-router";
import { solutionForPath } from "./product-navigation";
export function ProductFooter() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const operations = solutionForPath(pathname).id === "operations";
  return (
    <footer className="product-footer" data-solution={operations ? "operations" : "planning"}>
      <span>
        {operations
          ? "Power, battery and workload decision support."
          : "Property qualification & grid connection decision intelligence."}
      </span>
      <b>
        {operations
          ? "Assessment only—no physical commands."
          : "Capacity and connection terms require operator confirmation."}
      </b>
    </footer>
  );
}
