import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ProductHeader } from "./ProductChrome";

export function FinderShell({ children, workspace = false }: { children: ReactNode; workspace?: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const landingPage = pathname === "/";
  const methodologyPage = pathname === "/data-sources";
  return (
    <div
      className={`product-shell product-shell--focused finder-shell${landingPage ? " finder-shell--landing" : ""}${methodologyPage ? " finder-shell--methodology" : ""}${workspace ? " operations-workspace-shell" : ""}`}
    >
      <ProductHeader />
      {children}
      <footer className="product-footer">
        <span>Property qualification &amp; grid connection decision intelligence.</span>
        <b>Capacity and connection terms require operator confirmation.</b>
      </footer>
    </div>
  );
}
