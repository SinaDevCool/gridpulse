import { Link, useRouterState } from "@tanstack/react-router";
import {
  capabilityAvailable,
  isWorkspaceDestinationActive,
  workspaceLinksForMode,
} from "./product-navigation";
import { productMode } from "@/config/product-mode";
import { ThemeControl } from "@/features/theme/ThemeControl";
import { MapPinned, Search, TriangleAlert, type LucideIcon } from "lucide-react";

const workspaceIcons: Record<string, LucideIcon> = {
  sites: MapPinned,
  finder: Search,
  constraints: TriangleAlert,
};

export function ProductHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const marketingPage =
    pathname === "/" ||
    pathname === "/data-centres" ||
    pathname === "/energy-storage" ||
    pathname === "/hydrogen-industry";
  const marketingLinks = [
    { label: "Data Centres", to: "/data-centres" },
    { label: "Energy Storage", to: "/energy-storage" },
    { label: "Hydrogen & Industry", to: "/hydrogen-industry" },
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
      <ThemeControl />
    </header>
  );
}

export function ProductStageNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const links = workspaceLinksForMode(productMode);
  return (
    <nav className="product-stage-navigation" aria-label="Grid workspace navigation">
      <div>
        {links.map((item) => {
          const active = isWorkspaceDestinationActive(pathname, item.to);
          const available = capabilityAvailable(item.capability, productMode);
          const Icon = workspaceIcons[item.id];
          return (
            <Link
              key={item.to}
              to={item.to}
              className={active ? "active" : undefined}
              aria-current={active ? "page" : undefined}
              data-availability={available ? "available" : "prerequisite"}
              title={
                available
                  ? undefined
                  : `${item.label} prerequisites are not enabled in this product mode`
              }
            >
              {Icon ? <Icon aria-hidden="true" /> : null}
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
                {!available ? <em>Prerequisites</em> : null}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
