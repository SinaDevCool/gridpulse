import { Link, useRouterState } from "@tanstack/react-router";
import {
  capabilityAvailable,
  isWorkspaceDestinationActive,
  workspaceDestinationsForMode,
} from "./product-navigation";
import { productMode } from "@/config/product-mode";
import { ThemeControl } from "@/features/theme/ThemeControl";
import { Gauge, MapPinned, Menu, Search, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const workspaceIcons: Record<string, LucideIcon> = {
  sites: MapPinned,
  finder: Search,
  operations: Gauge,
};

export function ProductHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [hydrated, setHydrated] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationToggleRef = useRef<HTMLButtonElement>(null);
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
  const workspaceDestinations = workspaceDestinationsForMode(productMode);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!navigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setNavigationOpen(false);
      navigationToggleRef.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [navigationOpen]);

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
        <>
          <WorkspaceNavigation
            pathname={pathname}
            destinations={workspaceDestinations}
            open={navigationOpen}
            onNavigate={() => setNavigationOpen(false)}
          />
          <button
            ref={navigationToggleRef}
            type="button"
            className="workspace-navigation-toggle"
            aria-label={navigationOpen ? "Close workspace navigation" : "Open workspace navigation"}
            aria-expanded={navigationOpen}
            aria-controls="workspace-navigation"
            disabled={!hydrated}
            onClick={() => setNavigationOpen((open) => !open)}
          >
            {navigationOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </>
      )}
      <ThemeControl />
    </header>
  );
}

type WorkspaceDestination = ReturnType<typeof workspaceDestinationsForMode>[number];

function WorkspaceNavigation({
  pathname,
  destinations,
  open,
  onNavigate,
}: {
  pathname: string;
  destinations: readonly WorkspaceDestination[];
  open: boolean;
  onNavigate: () => void;
}) {
  return (
    <nav
      id="workspace-navigation"
      className="workspace-navigation"
      aria-label="GridPulse workspace"
      data-open={open ? "true" : "false"}
    >
      {destinations.map((item, index) => {
        const active = isWorkspaceDestinationActive(pathname, item.to);
        const available = capabilityAvailable(item.capability, productMode);
        const Icon = workspaceIcons[item.id];
        return (
          <span className="workspace-navigation-item" key={item.to}>
            {index > 0 && item.group !== destinations[index - 1]?.group ? (
              <span className="workspace-navigation-divider" aria-hidden="true" />
            ) : null}
            <Link
              to={item.to}
              className={active ? "active" : undefined}
              aria-current={active ? "page" : undefined}
              data-availability={available ? "available" : "prerequisite"}
              title={
                available
                  ? undefined
                  : `${item.label} prerequisites are not enabled in this product mode`
              }
              onClick={onNavigate}
            >
              {Icon ? <Icon aria-hidden="true" /> : null}
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
                {!available ? <em>Prerequisites</em> : null}
              </span>
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
