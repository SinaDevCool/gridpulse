import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

const publicNavigation = [
  { label: "How It Works", to: "/service" },
  { label: "Product Tour", to: "/demo" },
  { label: "Methodology", to: "/data-sources" },
] as const;

export function PublicBrand() {
  return (
    <Link to="/" className="public-brand" aria-label="GridPulse home" translate="no">
      <span>GRID</span>PULSE
    </Link>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="public-shell">
      <header className="public-header">
        <PublicBrand />
        <nav className={menuOpen ? "is-open" : undefined} aria-label="Public navigation">
          {publicNavigation.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link
            to="/auth"
            search={{ redirect: undefined }}
            className="public-sign-in"
            onClick={() => setMenuOpen(false)}
          >
            Sign In
          </Link>
          <Link
            to="/pilot"
            className="public-header-cta"
            onClick={() => {
              setMenuOpen(false);
              trackEvent("public_start_pilot_clicked", { placement: "header" });
            }}
          >
            Start a Pilot
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
          <Link to="/auth" search={{ redirect: undefined }}>
            Sign In
          </Link>
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
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="public-final-cta">
      <p className="public-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="public-actions">
        <Link
          to="/pilot"
          className="public-button public-button-primary"
          onClick={() => trackEvent("public_start_pilot_clicked", { placement: "final_cta" })}
        >
          Start a Pilot <ArrowRight aria-hidden="true" />
        </Link>
        <Link to="/demo" className="public-text-link">
          View the Product Tour <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
