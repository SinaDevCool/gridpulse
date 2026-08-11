import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ProductHeader, ProductStageNavigation } from "./ProductChrome";

export function FinderShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const landingPage = pathname === "/";
  const workspacePage = pathname.startsWith("/activation") || pathname.startsWith("/operations");
  const methodologyPage = pathname === "/data-sources";
  const marketingPage =
    landingPage ||
    methodologyPage ||
    pathname === "/data-centres" ||
    pathname === "/energy-storage" ||
    pathname === "/hydrogen-industry";
  return (
    <div
      className={`product-shell product-shell--focused finder-shell${landingPage ? " finder-shell--landing" : ""}${workspacePage ? " finder-shell--workspace" : ""}${methodologyPage ? " finder-shell--methodology" : ""}`}
    >
      <ProductHeader />
      {marketingPage ? null : <ProductStageNavigation />}
      {children}
      <footer className="product-footer">
        <span>Screening, activation planning &amp; operational simulation.</span>
        <b>Operator confirmation remains required.</b>
      </footer>
    </div>
  );
}
