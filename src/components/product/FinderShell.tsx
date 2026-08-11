import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ProductHeader, ProductStageNavigation } from "./ProductChrome";

export function FinderShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const landingPage = pathname === "/";
  const methodologyPage = pathname === "/data-sources";
  const marketingPage =
    landingPage ||
    methodologyPage ||
    pathname === "/data-centres" ||
    pathname === "/energy-storage" ||
    pathname === "/hydrogen-industry";
  return (
    <div
      className={`product-shell product-shell--focused finder-shell${landingPage ? " finder-shell--landing" : ""}${methodologyPage ? " finder-shell--methodology" : ""}`}
    >
      <ProductHeader />
      {marketingPage ? null : <ProductStageNavigation />}
      {children}
      <footer className="product-footer">
        <span>Property qualification &amp; grid connection decision intelligence.</span>
        <b>Capacity and connection terms require operator confirmation.</b>
      </footer>
    </div>
  );
}
