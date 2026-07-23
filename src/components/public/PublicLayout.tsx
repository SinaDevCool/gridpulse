import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/context/useAuth";

const publicNavigation = [
  { label: "How It Works", to: "/", hash: "how-it-works" },
  { label: "Assessment", to: "/service" },
  { label: "Product Tour", to: "/demo" },
  { label: "Methodology & Sources", to: "/data-sources" },
] as const;

export function PublicBrand() {
  return (
    <Link to="/" className="public-brand" aria-label="GridPulse home" translate="no">
      <span>GRID</span>PULSE
    </Link>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const onPilotPage = location.pathname === "/pilot";
  return (
    <div className="public-shell">
      <header className="public-header">
        <PublicBrand />
        <nav className={menuOpen ? "is-open" : undefined} aria-label="Public navigation">
          {publicNavigation.map((item) => (
            <Link
              key={`${item.to}-${"hash" in item ? item.hash : ""}`}
              to={item.to}
              hash={"hash" in item ? item.hash : undefined}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "is-active", "aria-current": "page" }}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {user ? (
            <Link to="/portfolio" className="public-sign-in" onClick={() => setMenuOpen(false)}>
              Workspace
            </Link>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: undefined }}
              className="public-sign-in"
              onClick={() => setMenuOpen(false)}
            >
              Sign In
            </Link>
          )}
          <Link
            to="/pilot"
            hash={onPilotPage ? "pilot-form" : undefined}
            className="public-header-cta"
            onClick={() => {
              setMenuOpen(false);
              trackEvent("public_start_pilot_clicked", { placement: "header" });
            }}
          >
            {onPilotPage ? "Continue Application" : "Start a Pilot"}
          </Link>
        </nav>
        <button
          type="button"
          className="public-menu-button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>
      {children}
      <PublicFooter />
    </div>
  );
}

export function PublicFooter() {
  const { user } = useAuth();
  return (
    <footer className="public-footer">
      <div className="public-container public-footer-grid">
        <div>
          <PublicBrand />
          <p>Evidence-led grid-connection decision support for German infrastructure projects.</p>
        </div>
        <nav aria-label="Public footer navigation">
          <Link to="/service">Assessment</Link>
          <Link to="/demo">Product Tour</Link>
          <Link to="/data-sources">Methodology &amp; Sources</Link>
          <Link to="/pilot">Start a Pilot</Link>
          {user ? (
            <Link to="/portfolio">Workspace</Link>
          ) : (
            <Link to="/auth" search={{ redirect: undefined }}>
              Sign In
            </Link>
          )}
        </nav>
      </div>
      <div className="public-container public-footer-boundary">
        <span>© 2026 GridPulse</span>
        <p>
          GridPulse provides customer-side decision support. Capacity, connection points,
          restrictions, works, timing, and final terms require network-operator confirmation.
        </p>
      </div>
    </footer>
  );
}

export function PublicPageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="public-page-hero">
      <p className="public-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
      {children ? <div className="public-actions">{children}</div> : null}
    </header>
  );
}

export function PublicCTA({
  eyebrow,
  title,
  description,
  primaryLabel = "Start a Pilot",
  primaryTo = "/pilot",
  primaryHash,
  secondaryLabel = "View the Product Tour",
  secondaryTo = "/demo",
  secondaryHash,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryTo?: "/pilot" | "/service" | "/demo" | "/data-sources";
  primaryHash?: string;
  secondaryLabel?: string;
  secondaryTo?: "/pilot" | "/service" | "/demo" | "/data-sources";
  secondaryHash?: string;
}) {
  return (
    <section className="public-final-cta">
      <p className="public-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="public-actions">
        <Link
          to={primaryTo}
          hash={primaryHash}
          className="public-button public-button-primary"
          onClick={() => trackEvent("public_start_pilot_clicked", { placement: "final_cta" })}
        >
          {primaryLabel} <ArrowRight aria-hidden="true" />
        </Link>
        <Link to={secondaryTo} hash={secondaryHash} className="public-text-link">
          {secondaryLabel} <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
