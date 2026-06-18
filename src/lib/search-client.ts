// Browser-side search across articles and projects using Postgres full-text
// search. Both tables expose public SELECT to anon, so this works for
// signed-out visitors too.
import { supabase } from "@/integrations/supabase/client";

export interface ArticleHit {
  kind: "article";
  id: string;
  slug: string;
  headline: string;
  summary: string;
  category: string;
  region: string;
  source_name: string | null;
  published_at: string | null;
  tags: string[];
}

export interface ProjectHit {
  kind: "project";
  id: string;
  name: string;
  developer: string | null;
  technology: string | null;
  location: string | null;
  region: string | null;
  capacity_mw: number | null;
  status: string | null;
}

export type SearchHit = ArticleHit | ProjectHit;

export interface SearchResults {
  articles: ArticleHit[];
  projects: ProjectHit[];
  total: number;
}

// Convert a free-text query to a websearch_to_tsquery-safe string by
// stripping characters that have special meaning. We rely on the Postgres
// `websearch_to_tsquery` parser, which already understands quotes, OR, and
// minus signs.
function sanitizeQuery(q: string): string {
  return q.replace(/[\\;]/g, " ").trim().slice(0, 200);
}

export async function searchAll(rawQuery: string, limit = 20): Promise<SearchResults> {
  const q = sanitizeQuery(rawQuery);
  if (!q) return { articles: [], projects: [], total: 0 };

  // For PostgREST text-search filter we pass the user input as the value of
  // a `wfts` (websearch full-text search) operator. PostgREST escapes the
  // value before forwarding it to `websearch_to_tsquery`, so no further
  // quoting is needed.
  const [articlesRes, projectsRes] = await Promise.all([
    supabase
      .from("articles")
      .select("id,slug,headline,summary,category,region,source_name,published_at,tags")
      .textSearch("search_tsv", q, { type: "websearch", config: "english" })
      .order("published_at", { ascending: false })
      .limit(limit),
    supabase
      .from("projects")
      .select("id,name,developer,technology,location,region,capacity_mw,status")
      .textSearch("search_tsv", q, { type: "websearch", config: "english" })
      .order("capacity_mw", { ascending: false })
      .limit(limit),
  ]);

  const articles: ArticleHit[] = (articlesRes.data ?? []).map((r) => ({
    kind: "article",
    id: r.id as string,
    slug: r.slug as string,
    headline: r.headline as string,
    summary: r.summary as string,
    category: r.category as string,
    region: r.region as string,
    source_name: (r.source_name as string) ?? null,
    published_at: (r.published_at as string) ?? null,
    tags: (r.tags as string[]) ?? [],
  }));

  const projects: ProjectHit[] = (projectsRes.data ?? []).map((r) => ({
    kind: "project",
    id: r.id as string,
    name: r.name as string,
    developer: (r.developer as string) ?? null,
    technology: (r.technology as string) ?? null,
    location: (r.location as string) ?? null,
    region: (r.region as string) ?? null,
    capacity_mw: (r.capacity_mw as number) ?? null,
    status: (r.status as string) ?? null,
  }));

  return {
    articles,
    projects,
    total: articles.length + projects.length,
  };
}
