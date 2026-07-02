// Shared types and presentational helpers for GridPulse.
// All runtime data is loaded from Supabase via src/lib/gridpulse-repo.ts.

export type ArticleCategory =
  | "breaking"
  | "analysis"
  | "deals"
  | "policy"
  | "technology"
  | "safety"
  | "markets";

export interface Article {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  content: string;
  whyItMatters: string;
  category: ArticleCategory;
  source: { name: string; domain: string };
  author: string;
  minutesAgo: number;
  readMinutes: number;
  verified: boolean;
  tags: string[];
  region: string;
  isBreaking?: boolean;
  alsoReportedBy?: string[];
  relatedProjectIds?: string[];
  // Provenance
  sourceUrl?: string | null;
  sourceType?: string; // 'rss' | 'manual' | 'seed'
  fetchedAt?: string | null;
  lastVerifiedAt?: string | null;
  verificationStatus?: string; // 'verified' | 'unverified' | 'demo'
}

export interface Project {
  id: string;
  slug?: string;
  name: string;
  developer: string;
  capacityMw: number;
  capacityMwh: number;
  technology: string;
  location: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  status: "Permitting" | "Construction" | "Commissioning" | "Operational";
  cod: string;
  description?: string;
  owner?: string;
  operator?: string;
  chemistry?: string;
  useCase?: string;
  offtaker?: string;
  sourceUrls?: string[];
  lastVerifiedAt?: string;
  // Provenance
  sourceType?: string; // 'rss' | 'manual' | 'seed'
  fetchedAt?: string | null;
  verificationStatus?: string; // 'verified' | 'unverified' | 'demo'
}

export const categoryStyles: Record<ArticleCategory, { label: string; className: string }> = {
  breaking:   { label: "BREAKING",   className: "bg-red-accent/15 text-red-accent border-red-accent/40" },
  analysis:   { label: "ANALYSIS",   className: "bg-cyan-accent/10 text-cyan-accent border-cyan-accent/40" },
  deals:      { label: "DEALS",      className: "bg-green-accent/10 text-green-accent border-green-accent/40" },
  policy:     { label: "POLICY",     className: "bg-amber-accent/10 text-amber-accent border-amber-accent/40" },
  technology: { label: "TECHNOLOGY", className: "bg-cyan-accent/10 text-cyan-accent border-cyan-accent/40" },
  safety:     { label: "SAFETY",     className: "bg-red-accent/10 text-red-accent border-red-accent/40" },
  markets:    { label: "MARKETS",    className: "bg-green-accent/10 text-green-accent border-green-accent/40" },
};

export function formatMinutesAgo(m: number): string {
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
