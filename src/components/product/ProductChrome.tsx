import { Link, useRouterState } from "@tanstack/react-router";
const workspaceLinks = [
  { label: "Site Pipeline", detail: "Qualify opportunities", to: "/portfolio" },
  { label: "Power Finder", detail: "Investigate candidates", to: "/power-finder" },
  { label: "Decision Centre", detail: "Review evidence", to: "/reports" },
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
  const links = workspaceLinks;
  return (
    <nav className="product-stage-navigation" aria-label="Grid workspace navigation">
      <div>
        {links.map((item, index) => {
          const active =
            pathname.startsWith(item.to) ||
            (item.to === "/reports" && pathname.startsWith("/capacity-dossiers/"));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={active ? "active" : undefined}
              aria-current={active ? "page" : undefined}
              onClick={(event) => {
                if (active) event.preventDefault();
              }}
            >
              <span>0{index + 1}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
