import { Activity,BatteryCharging,Cable,Database,PlugZap,Zap } from "lucide-react";

import { useOperationsCapabilities } from "../use-operations-capabilities";

export function ConnectorStatus() {
  const { data: capabilities } = useOperationsCapabilities();
  const iconFor = (id: string) =>
    id === "facility_meter" ? (
      <Activity />
    ) : id === "bms" ? (
      <BatteryCharging />
    ) : id === "nvidia_dcgm" ? (
      <Zap />
    ) : id === "openems" ? (
      <PlugZap />
    ) : id === "sunspec" ? (
      <Cable />
    ) : (
      <Database />
    );
  const connectors =
    capabilities?.connectors.filter((connector) =>
      ["facility_meter", "bms", "nvidia_dcgm"].includes(connector.id),
    ) ?? [];
  return (
    <article className="power-connectors">
      <header>
        <div>
          <p className="context-label">Evidence & connector status</p>
          <h3>Read-only data paths</h3>
        </div>
        <span>
          {connectors.some((item) => item.status === "connected")
            ? "Live evidence connected"
            : "No live connectors configured"}
        </span>
      </header>
      <div>
        {connectors.map((item) => (
          <section key={item.id}>
            <span aria-hidden="true">{iconFor(item.id)}</span>
            <div>
              <strong>{item.label}</strong>
              <small>{item.transport}</small>
            </div>
            <i>Read only</i>
          </section>
        ))}
      </div>
    </article>
  );
}
