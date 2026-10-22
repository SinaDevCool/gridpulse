import { Link, useRouterState } from "@tanstack/react-router";
import {
  capabilityAvailable,
  isWorkspaceDestinationActive,
  solutionDestinations,
} from "./product-navigation";
import { productMode } from "@/config/product-mode";
import { ThemeControl } from "@/features/theme/ThemeControl";
import { SolutionSwitcher } from "./SolutionSwitcher";
import type { ReactNode } from "react";
import { enabledSolutions, solutions } from "@/config/solutions";

export function ProductHeader({ navigation }: { navigation?: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const marketingPage = ["/", "/data-centres", "/energy-storage", "/hydrogen-industry"].includes(
    pathname,
  );
  const marketingLinks = [
    { label: "Data Centres", to: "/data-centres" },
    { label: "Energy Storage", to: "/energy-storage" },
    { label: "Hydrogen & Industry", to: "/hydrogen-industry" },
  ] as const;
  return (
    <header
      className={`app-header product-header--minimal ${marketingPage ? "" : "product-header--application"}`}
    >
      <Link to="/" className="brand" aria-label="GridPulse home" translate="no">
        <span>GRID</span>
        <strong>PULSE</strong>
      </Link>
      {marketingPage ? (
        <nav className="product-marketing-navigation" aria-label="Solutions navigation">
          {marketingLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={pathname === item.to ? "active" : undefined}
              aria-current={pathname === item.to ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to={solutions.find((item) => enabledSolutions.includes(item.id))!.to}
            className="product-marketing-cta"
          >
            Open Workspace
          </Link>
        </nav>
      ) : (
        <>
          <SolutionSwitcher pathname={pathname} />
          {navigation ?? (
            <nav
              id="workspace-navigation"
              className="solution-ribbon"
              aria-label="GridPulse workspace"
            >
              {solutionDestinations(pathname, productMode).map((item) => {
                const active = isWorkspaceDestinationActive(pathname, item.to);
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    aria-label={`${item.label} ${item.detail}`}
                    className={active ? "active" : undefined}
                    aria-current={active ? "page" : undefined}
                    data-availability={
                      capabilityAvailable(item.capability, productMode)
                        ? "available"
                        : "prerequisite"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </>
      )}
      <ThemeControl />
    </header>
  );
}
