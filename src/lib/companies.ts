// Company aggregation derived from the live projects table.
// A "company" is any distinct organization that appears as developer, owner,
// operator, or offtaker on a project. We synthesize slugs and roll up stats
// so /companies and /companies/:slug stay backed by real DB data with no
// extra schema work.

import { queryOptions } from "@tanstack/react-query";
import { projectsQuery } from "./gridpulse-repo";
import type { Project, Article } from "./gridpulse-data";

export type CompanyRole = "developer" | "owner" | "operator" | "offtaker";

export interface Company {
  slug: string;
  name: string;
  roles: CompanyRole[];
  projectIds: string[]; // external_id values
  projectCount: number;
  totalMw: number;
  totalMwh: number;
  countries: string[];
  regions: string[];
  chemistries: string[];
  statusBreakdown: Record<string, number>;
  lastVerifiedAt?: string;
}

const STOPWORDS = new Set([
  "tbd",
  "unknown",
  "n/a",
  "na",
  "",
]);

export function slugifyCompany(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function pushRole(map: Map<string, Company>, raw: string | undefined | null, role: CompanyRole, p: Project) {
  if (!raw) return;
  const name = raw.trim();
  if (!name || STOPWORDS.has(name.toLowerCase())) return;
  const slug = slugifyCompany(name);
  if (!slug) return;
  let c = map.get(slug);
  if (!c) {
    c = {
      slug,
      name,
      roles: [],
      projectIds: [],
      projectCount: 0,
      totalMw: 0,
      totalMwh: 0,
      countries: [],
      regions: [],
      chemistries: [],
      statusBreakdown: {},
    };
    map.set(slug, c);
  }
  if (!c.roles.includes(role)) c.roles.push(role);
  if (!c.projectIds.includes(p.id)) {
    c.projectIds.push(p.id);
    c.projectCount += 1;
    c.totalMw += p.capacityMw;
    c.totalMwh += p.capacityMwh;
    if (p.country && !c.countries.includes(p.country)) c.countries.push(p.country);
    if (p.region && !c.regions.includes(p.region)) c.regions.push(p.region);
    const chem = p.chemistry ?? p.technology;
    if (chem && !c.chemistries.includes(chem)) c.chemistries.push(chem);
    c.statusBreakdown[p.status] = (c.statusBreakdown[p.status] ?? 0) + 1;
    if (p.lastVerifiedAt && (!c.lastVerifiedAt || p.lastVerifiedAt > c.lastVerifiedAt)) {
      c.lastVerifiedAt = p.lastVerifiedAt;
    }
  }
}

export function deriveCompanies(projects: Project[]): Company[] {
  const map = new Map<string, Company>();
  for (const p of projects) {
    pushRole(map, p.developer, "developer", p);
    pushRole(map, p.owner, "owner", p);
    pushRole(map, p.operator, "operator", p);
    pushRole(map, p.offtaker, "offtaker", p);
  }
  return Array.from(map.values()).sort((a, b) => b.totalMwh - a.totalMwh || b.projectCount - a.projectCount);
}

export function findCompanyBySlug(projects: Project[], slug: string): Company | null {
  return deriveCompanies(projects).find((c) => c.slug === slug) ?? null;
}

export function projectsForCompany(projects: Project[], company: Company): Project[] {
  const ids = new Set(company.projectIds);
  return projects.filter((p) => ids.has(p.id));
}

/** Heuristic: an article matches a company if its headline/summary/tags/source mention the company name. */
export function articlesForCompany(articles: Article[], company: Company): Article[] {
  const needle = company.name.toLowerCase();
  return articles.filter((a) => {
    const hay = `${a.headline} ${a.summary} ${(a.tags ?? []).join(" ")} ${a.source.name}`.toLowerCase();
    return hay.includes(needle);
  });
}

export const companiesQuery = () =>
  queryOptions({
    queryKey: ["companies"],
    queryFn: async () => {
      // Reuse the projects fetcher rather than touching the DB twice.
      const opts = projectsQuery();
      const projects = (await opts.queryFn!({} as never)) as Project[];
      const live = projects.filter(
        (p) => p.verificationStatus !== "demo" && p.sourceType !== "seed",
      );
      return deriveCompanies(live);
    },
    staleTime: 5 * 60_000,
  });
