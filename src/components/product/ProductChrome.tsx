import { Link, useRouterState } from "@tanstack/react-router";
import { productCapabilities } from "@/config/product-mode";

const finderWorkspaceLinks = [
  { label: "Power Finder", detail: "Screen connection candidates", to: "/power-finder" },
] as const;

const privateWorkspaceLinks = [
  { label: "Properties", detail: "Qualify the portfolio", to: "/portfolio" },
  { label: "Power Finder", detail: "Investigate candidates", to: "/power-finder" },
  { label: "Reports", detail: "Review decision evidence", to: "/reports" },
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
  const privateWorkflow =
    productCapabilities.authentication &&
    ["/portfolio", "/assessments", "/reports", "/evidence", "/operator-review", "/submission-package"].some(
      (prefix) => pathname.startsWith(prefix),
    );
  const links = privateWorkflow ? privateWorkspaceLinks : finderWorkspaceLinks;
  return (
    <nav className="product-stage-navigation" aria-label="Grid workspace navigation">
      <div>
        {links.map((item, index) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={active ? "active" : undefined}
              aria-current={active ? "page" : undefined}
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
