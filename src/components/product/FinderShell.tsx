import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { finderContactEmail } from "@/config/product-mode";

export function FinderShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="product-shell finder-shell">
      <header className="app-header">
        <Link to="/" className="brand" aria-label="GridPulse Finder home" translate="no">
          <span>GRID</span>
          <strong>PULSE</strong>
        </Link>
        <nav aria-label="Finder navigation" className={menuOpen ? "is-open" : undefined}>
          <Link
            to="/power-finder"
            activeProps={{ className: "active" }}
            onClick={() => setMenuOpen(false)}
          >
            Power Finder
          </Link>
          <Link
            to="/data-sources"
            activeProps={{ className: "active" }}
            onClick={() => setMenuOpen(false)}
          >
            Data &amp; Methodology
          </Link>
          <a href={`mailto:${finderContactEmail}`} onClick={() => setMenuOpen(false)}>
            Contact
          </a>
        </nav>
        <button
          type="button"
          className="app-menu-button"
          aria-label={menuOpen ? "Close Finder navigation" : "Open Finder navigation"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <div className="header-account">
          <a href={`mailto:${finderContactEmail}`} className="primary-button">
            Discuss a site
          </a>
        </div>
      </header>
      {children}
      <footer className="product-footer">
        <span>GridPulse Power Finder · German grid-connection screening</span>
        <b>Unknown capacity remains unknown.</b>
      </footer>
    </div>
  );
}
