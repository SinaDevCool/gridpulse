import { StrategyComparison } from "./StrategyComparison";
import { StrategyDeliverables } from "./StrategyDeliverables";
import { StrategyFlexibility } from "./StrategyFlexibility";
import { StrategyScreening } from "./StrategyScreening";
import type { StrategyControllerContract } from "./controller-contract";
export function StrategyScreen({ model }: { model: StrategyControllerContract }) {
  const { view, setView } = model;
  return (
    <section className="strategy-workbench">
      <header className="room-heading">
        <div>
          <p className="context-label">German connection strategy</p>
          <h2>From site screening to a package ready for operator review</h2>
          <p>
            Public context supports screening only. Capacity and dates remain operator-controlled.
          </p>
        </div>
        <span className="status warning-text">Planning model · not a connection offer</span>
      </header>
      <nav className="strategy-nav" aria-label="Connection strategy stages">
        {(["screen", "options", "flexibility", "deliver"] as const).map((item, index) => (
          <button
            key={item}
            className={view === item ? "active" : ""}
            onClick={() => setView(item)}
          >
            <span>0{index + 1}</span>
            {item === "deliver" ? "Package & memo" : item}
          </button>
        ))}
      </nav>

      {view === "screen" ? (
        <StrategyScreening model={model} />
      ) : view === "options" ? (
        <StrategyComparison model={model} />
      ) : view === "flexibility" ? (
        <StrategyFlexibility model={model} />
      ) : (
        <StrategyDeliverables model={model} />
      )}
    </section>
  );
}
