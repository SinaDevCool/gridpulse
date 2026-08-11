import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ProductTruthNotice } from "./ProductTruthNotice";
import { productCapabilities } from "@/config/product-mode";
import { FinderShell } from "./FinderShell";
import { ProductHeader, ProductStageNavigation } from "./ProductChrome";

export function AppShell({ children }: { children: ReactNode; requireAuth?: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const publicProduct = ["/power-finder", "/activation", "/operations"].some((path) =>
    pathname.startsWith(path),
  );
  const workspacePage = pathname.startsWith("/activation") || pathname.startsWith("/operations");
  if (!productCapabilities.workspace) return <FinderShell>{children}</FinderShell>;
  return (
    <div
      className={`product-shell${publicProduct ? " product-shell--focused" : ""}${workspacePage ? " product-shell--workspace" : ""}`}
    >
      <ProductHeader />
      <ProductStageNavigation />
      {publicProduct ? <ProductTruthNotice compact /> : null}
      {children}
      <footer className="product-footer">
        <span>Screening, activation planning &amp; operational simulation.</span>
        <b>Operator confirmation remains required.</b>
      </footer>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="context-label">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
