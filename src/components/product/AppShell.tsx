import { Navigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ProductTruthNotice } from "./ProductTruthNotice";
import { productCapabilities } from "@/config/product-mode";
import { FinderShell } from "./FinderShell";
import { ProductHeader, ProductStageNavigation } from "./ProductChrome";
import { useAuth } from "@/context/useAuth";

function AuthenticatedBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.href });
  if (loading) {
    return (
      <main id="main-content" className="empty-page" role="status" aria-live="polite">
        <p>Checking workspace access…</p>
      </main>
    );
  }
  if (!user) return <Navigate to="/auth" search={{ redirect: pathname }} replace />;
  return children;
}

export function AppShell({ children, requireAuth = false }: { children: ReactNode; requireAuth?: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const publicProduct = pathname.startsWith("/power-finder");
  if (!productCapabilities.workspace) return <FinderShell>{children}</FinderShell>;
  const shell = (
    <div
      className={`product-shell${publicProduct ? " product-shell--focused" : ""}`}
    >
      <ProductHeader />
      <ProductStageNavigation />
      {publicProduct ? <ProductTruthNotice compact /> : null}
      {children}
      <footer className="product-footer">
        <span>Property qualification &amp; grid connection decision intelligence.</span>
        <b>Capacity and connection terms require operator confirmation.</b>
      </footer>
    </div>
  );
  return requireAuth ? <AuthenticatedBoundary>{shell}</AuthenticatedBoundary> : shell;
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
