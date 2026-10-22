import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { productCapabilities } from "@/config/product-mode";
import { ProductShell } from "./ProductShell";
import { solutionForPath } from "@/config/solutions";
import { useAuth } from "@/context/useAuth";

function AuthenticatedBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const solution = solutionForPath(pathname);
  if (loading) {
    return (
      <main id="main-content" className="empty-page" role="status" aria-live="polite">
        <p>Checking workspace access…</p>
      </main>
    );
  }
  if (!user)
    return (
      <main id="main-content" className="empty-page">
        <h1>Private {solution.label} access required</h1>
        <p>
          This workspace requires an authenticated account. Public scenarios do not grant
          private-data access.
        </p>
        <Link to={solution.to}>Return to {solution.label}</Link>
      </main>
    );
  return children;
}

export function AppShell({
  children,
  requireAuth = false,
  workspace = false,
  navigation,
}: {
  children: ReactNode;
  requireAuth?: boolean;
  workspace?: boolean;
  navigation?: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const publicProduct = pathname.startsWith("/power-finder");
  const shell = (
    <ProductShell
      workspace={workspace}
      navigation={navigation}
      focused={!productCapabilities.workspace || publicProduct}
      truthNotice={productCapabilities.workspace && publicProduct}
    >
      {children}
    </ProductShell>
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
