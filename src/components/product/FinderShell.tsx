import type { ReactNode } from "react";
import { ProductHeader, ProductStageNavigation } from "./ProductChrome";

export function FinderShell({ children }: { children: ReactNode }) {
  return (
    <div className="product-shell product-shell--focused finder-shell">
      <ProductHeader />
      <ProductStageNavigation />
      {children}
      <footer className="product-footer">
        <span>Screening, activation planning &amp; operational simulation.</span>
        <b>Operator confirmation remains required.</b>
      </footer>
    </div>
  );
}
