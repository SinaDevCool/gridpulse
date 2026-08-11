import { Link, useRouterState } from "@tanstack/react-router";

const productStages = [
  { number: "01", label: "Find Capacity", detail: "Screen grid opportunity", to: "/power-finder" },
  {
    number: "02",
    label: "Plan Activation",
    detail: "Shape a flexible connection",
    to: "/activation",
  },
  { number: "03", label: "Run Operations", detail: "Monitor approved limits", to: "/operations" },
] as const;

export function ProductHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const marketingPage =
    pathname === "/" ||
    pathname === "/data-sources" ||
    pathname === "/data-centres" ||
    pathname === "/energy-storage" ||
    pathname === "/hydrogen-industry";
  const marketingLinks = [
    { label: "Data Centres", to: "/data-centres" },
    { label: "Energy Storage", to: "/energy-storage" },
    { label: "Hydrogen & Industry", to: "/hydrogen-industry" },
    { label: "Methodology", to: "/data-sources" },
  ] as const;
  return (
    <header className="app-header product-header--minimal">
      <Link to="/" className="brand" aria-label="GridPulse home" translate="no">
        <span>GRID</span>
        <strong>PULSE</strong>
      </Link>
      {marketingPage ? (
        <nav className="product-marketing-navigation" aria-label="Solutions navigation">
          {marketingLinks.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
          <Link to="/power-finder" className="product-marketing-cta">
            Open Workspace
          </Link>
        </nav>
      ) : (
        <span className="product-header-label">Grid Intelligence Workspace</span>
      )}
    </header>
  );
}

export function ProductStageNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav className="product-stage-navigation" aria-label="GridPulse product stages">
      <div>
        {productStages.map((stage) => {
          const active = pathname.startsWith(stage.to);
          return (
            <Link
              key={stage.to}
              to={stage.to}
              className={active ? "active" : undefined}
              aria-current={active ? "page" : undefined}
            >
              <span>{stage.number}</span>
              <span>
                <strong>{stage.label}</strong>
                <small>{stage.detail}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
