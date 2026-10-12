import { StrategyScreen } from "./strategy/StrategyScreen";
import { useStrategyController } from "./strategy/use-strategy-controller";

import { type Props } from "./strategy/contracts";

export function StrategyWorkbench({ site, evidence, scenarios, profiles, refresh }: Props) {
  return (
    <StrategyScreen
      model={useStrategyController({ site, evidence, scenarios, profiles, refresh })}
    />
  );
}
