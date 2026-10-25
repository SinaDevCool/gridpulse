import type { ReactNode } from "react";

export function BatteryWorkspaceHeading({ badge }: { badge: ReactNode }) {
  return <header className="power-workspace-heading"><div>
    <p className="context-label">Battery response & reserve</p><h3>Facility Power & Battery Response</h3>
  </div>{badge}</header>;
}
