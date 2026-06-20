// Live data layer for GridPulse. Reads from Supabase via the browser client
// (articles/projects tables have public anon SELECT policies). Returns shapes
// matching the legacy `Article` / `Project` types used by existing components.

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Article, Project, ArticleCategory } from "./gridpulse-data";

type ArticleRow = {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  content: string | null;
  why_it_matters: string | null;
  category: string;
  source_name: string | null;
  source_domain: string | null;
  source_url: string | null;
  author: string | null;
  read_minutes: number | null;
  verified: boolean | null;
  is_breaking: boolean | null;
  tags: string[] | null;
  region: string | null;
  also_reported_by: string[] | null;
  related_project_ids: string[] | null;
  published_at: string | null;
  source_type: string | null;
  fetched_at: string | null;
  last_verified_at: string | null;
  verification_status: string | null;
};

type ProjectRow = {
  id: string;
  external_id: string | null;
  slug: string | null;
  name: string;
  developer: string | null;
  capacity_mw: number | null;
  capacity_mwh: number | null;
  technology: string | null;
  location: string | null;
  country: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  status: string | null;
  cod: string | null;
  description: string | null;
  owner: string | null;
  operator: string | null;
  chemistry: string | null;
  use_case: string | null;
  offtaker: string | null;
  source_urls: string[] | null;
  last_verified_at: string | null;
  source_type: string | null;
  fetched_at: string | null;
  verification_status: string | null;
};


function mapArticle(r: ArticleRow): Article {
  const published = r.published_at ? new Date(r.published_at).getTime() : Date.now();
  const minutesAgo = Math.max(0, Math.round((Date.now() - published) / 60_000));
  return {
    id: r.id,
    slug: r.slug,
    headline: r.headline,
    summary: r.summary,
    content: r.content ?? "",
    whyItMatters: r.why_it_matters ?? "",
    category: (r.category as ArticleCategory) ?? "analysis",
    source: { name: r.source_name ?? "GridPulse", domain: r.source_domain ?? "gridpulse.app" },
    author: r.author ?? "GridPulse Desk",
    minutesAgo,
    readMinutes: r.read_minutes ?? 4,
    verified: !!r.verified,
    tags: r.tags ?? [],
    region: r.region ?? "Global",
    isBreaking: !!r.is_breaking,
    alsoReportedBy: r.also_reported_by ?? undefined,
    relatedProjectIds: r.related_project_ids ?? undefined,
    sourceUrl: r.source_url,
    sourceType: r.source_type ?? "manual",
    fetchedAt: r.fetched_at,
    lastVerifiedAt: r.last_verified_at,
    verificationStatus: r.verification_status ?? "unverified",
  };
}

function mapProject(r: ProjectRow): Project {
  return {
    id: r.external_id ?? r.id,
    slug: r.slug ?? undefined,
    name: r.name,
    developer: r.developer ?? "",
    capacityMw: Number(r.capacity_mw ?? 0),
    capacityMwh: Number(r.capacity_mwh ?? 0),
    technology: r.technology ?? "LFP",
    location: r.location ?? "",
    country: r.country ?? "",
    region: r.region ?? "",
    lat: Number(r.lat ?? 0),
    lng: Number(r.lng ?? 0),
    status: (r.status as Project["status"]) ?? "Permitting",
    cod: r.cod ?? "",
    description: r.description ?? undefined,
    owner: r.owner ?? undefined,
    operator: r.operator ?? undefined,
    chemistry: r.chemistry ?? undefined,
    useCase: r.use_case ?? undefined,
    offtaker: r.offtaker ?? undefined,
    sourceUrls: r.source_urls ?? [],
    lastVerifiedAt: r.last_verified_at ?? undefined,
    sourceType: r.source_type ?? "manual",
    fetchedAt: r.fetched_at,
    verificationStatus: r.verification_status ?? "unverified",
  };
}

const ARTICLE_COLS =
  "id,slug,headline,summary,content,why_it_matters,category,source_name,source_domain,source_url,author,read_minutes,verified,is_breaking,tags,region,also_reported_by,related_project_ids,published_at,source_type,fetched_at,last_verified_at,verification_status";

const PROJECT_COLS =
  "id,external_id,slug,name,developer,capacity_mw,capacity_mwh,technology,location,country,region,lat,lng,status,cod,description,owner,operator,chemistry,use_case,offtaker,source_urls,last_verified_at,source_type,fetched_at,verification_status";

export async function fetchArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLS)
    .order("published_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as ArticleRow[]).map(mapArticle);
}

export async function fetchArticleBySlug(slug: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? mapArticle(data as ArticleRow) : null;
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLS)
    .order("capacity_mwh", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as ProjectRow[]).map(mapProject);
}

export async function fetchProjectByExternalId(extId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLS)
    .eq("external_id", extId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProject(data as ProjectRow) : null;
}

export async function fetchProjectBySlugOrExternalId(key: string): Promise<Project | null> {
  // Try slug first, then external_id as fallback for legacy URLs
  const { data: bySlug } = await supabase
    .from("projects")
    .select(PROJECT_COLS)
    .eq("slug", key)
    .maybeSingle();
  if (bySlug) return mapProject(bySlug as ProjectRow);
  const { data: byExt, error } = await supabase
    .from("projects")
    .select(PROJECT_COLS)
    .eq("external_id", key)
    .maybeSingle();
  if (error) throw error;
  return byExt ? mapProject(byExt as ProjectRow) : null;
}

export const articlesQuery = () =>
  queryOptions({ queryKey: ["articles"], queryFn: fetchArticles, staleTime: 60_000 });

export const articleBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["article", slug],
    queryFn: () => fetchArticleBySlug(slug),
    staleTime: 60_000,
  });

export const projectsQuery = () =>
  queryOptions({ queryKey: ["projects"], queryFn: fetchProjects, staleTime: 5 * 60_000 });

export const projectByExternalIdQuery = (id: string) =>
  queryOptions({
    queryKey: ["project", id],
    queryFn: () => fetchProjectByExternalId(id),
    staleTime: 5 * 60_000,
  });

export const projectBySlugQuery = (key: string) =>
  queryOptions({
    queryKey: ["project-slug", key],
    queryFn: () => fetchProjectBySlugOrExternalId(key),
    staleTime: 5 * 60_000,
  });

