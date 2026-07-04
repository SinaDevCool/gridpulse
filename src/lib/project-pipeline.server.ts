// Server-only: scans recent articles, asks Lovable AI to extract BESS project
// metadata, and upserts the result into the projects table.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

type Region =
  | "north-america"
  | "europe"
  | "asia-pacific"
  | "middle-east"
  | "africa"
  | "latin-america"
  | "global";

interface Extracted {
  is_project: boolean;
  name: string | null;
  developer: string | null;
  owner: string | null;
  operator: string | null;
  offtaker: string | null;
  capacity_mw: number | null;
  capacity_mwh: number | null;
  chemistry: string | null;
  technology: string | null;
  grid: string | null;
  region: Region | null;
  country: string | null;
  location: string | null;
  status: string | null;
  cod: string | null;
  use_case: string | null;
}

interface ArticleRow {
  id: string;
  headline: string;
  summary: string | null;
  content: string | null;
  why_it_matters: string | null;
  source_url: string;
  source_name: string | null;
  region: string | null;
  category: string | null;
  tags: string[] | null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function regionDefaults(r: Region | null): { country: string; countryCode: string; lat: number; lng: number } {
  switch (r) {
    case "north-america":
      return { country: "United States", countryCode: "US", lat: 39.5, lng: -98.35 };
    case "europe":
      return { country: "Germany", countryCode: "DE", lat: 51.16, lng: 10.45 };
    case "asia-pacific":
      return { country: "China", countryCode: "CN", lat: 35.86, lng: 104.19 };
    case "middle-east":
      return { country: "United Arab Emirates", countryCode: "AE", lat: 24.0, lng: 54.0 };
    case "africa":
      return { country: "South Africa", countryCode: "ZA", lat: -8.78, lng: 34.5 };
    case "latin-america":
      return { country: "Chile", countryCode: "CL", lat: -14.23, lng: -51.92 };
    default:
      return { country: "Unknown", countryCode: "", lat: 0, lng: 0 };
  }
}

// Map country strings (from AI extraction) → ISO-3166 alpha-2 uppercase code.
// Also returns a normalized canonical country name.
function normalizeCountry(input: string | null): { country: string; countryCode: string | null } {
  const raw = (input ?? "").trim();
  if (!raw) return { country: "", countryCode: null };
  const key = raw.toLowerCase();
  const table: Record<string, [string, string]> = {
    "us": ["United States", "US"], "usa": ["United States", "US"], "u.s.": ["United States", "US"],
    "united states": ["United States", "US"], "united states of america": ["United States", "US"],
    "uk": ["United Kingdom", "GB"], "gb": ["United Kingdom", "GB"],
    "britain": ["United Kingdom", "GB"], "united kingdom": ["United Kingdom", "GB"],
    "germany": ["Germany", "DE"], "de": ["Germany", "DE"], "deutschland": ["Germany", "DE"],
    "australia": ["Australia", "AU"], "china": ["China", "CN"], "japan": ["Japan", "JP"],
    "india": ["India", "IN"], "chile": ["Chile", "CL"], "spain": ["Spain", "ES"],
    "saudi arabia": ["Saudi Arabia", "SA"], "new zealand": ["New Zealand", "NZ"],
    "uae": ["United Arab Emirates", "AE"], "united arab emirates": ["United Arab Emirates", "AE"],
    "south africa": ["South Africa", "ZA"], "france": ["France", "FR"],
    "italy": ["Italy", "IT"], "netherlands": ["Netherlands", "NL"], "canada": ["Canada", "CA"],
    "mexico": ["Mexico", "MX"], "brazil": ["Brazil", "BR"], "korea": ["South Korea", "KR"],
    "south korea": ["South Korea", "KR"], "sweden": ["Sweden", "SE"], "poland": ["Poland", "PL"],
    "ireland": ["Ireland", "IE"], "philippines": ["Philippines", "PH"], "indonesia": ["Indonesia", "ID"],
  };
  const hit = table[key];
  if (hit) return { country: hit[0], countryCode: hit[1] };
  // Pass through unrecognized names; leave code null so filter chips stay clean.
  return { country: raw, countryCode: null };
}


async function extractFromArticle(a: ArticleRow): Promise<Extracted> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const system = `You extract structured grid-scale Battery Energy Storage System (BESS) project metadata from energy industry news articles. Return ONLY JSON. If the article is NOT specifically about a real, identifiable BESS project (announcement, contract award, commissioning, regulatory filing, ground-breaking, COD), set is_project=false and leave other fields null. Do NOT extract from general market commentary, opinion pieces, or articles only mentioning BESS in passing.`;

  const user = `Article headline: ${a.headline}
Source: ${a.source_name ?? ""}
URL: ${a.source_url}
Summary: ${a.summary ?? ""}
Why it matters: ${a.why_it_matters ?? ""}
Body excerpt:
${(a.content ?? "").slice(0, 2000)}

Return JSON exactly matching:
{
  "is_project": boolean,
  "name": string|null (project name, no "the" prefix),
  "developer": string|null,
  "owner": string|null,
  "operator": string|null,
  "offtaker": string|null,
  "capacity_mw": number|null (power rating in MW),
  "capacity_mwh": number|null (energy capacity in MWh),
  "chemistry": string|null (e.g. "LFP","NMC","Sodium-ion","Flow"),
  "technology": string|null (e.g. "Lithium-ion BESS","Flow battery"),
  "grid": string|null (e.g. "ERCOT","CAISO","PJM","National Grid","NEM"),
  "region": one of "north-america","europe","asia-pacific","middle-east","africa","latin-america","global" or null,
  "country": string|null,
  "location": string|null (city/state),
  "status": one of "Announced","Permitting","Under Construction","Commissioning","Operational","Cancelled" or null,
  "cod": string|null (commercial operation date, YYYY or YYYY-MM),
  "use_case": string|null (e.g. "Co-located solar","Standalone arbitrage","Capacity market")
}`;

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit (429)");
  if (res.status === 402) throw new Error("AI credits exhausted (402)");
  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content) as Extracted;
}

export interface ProjectRunResult {
  scanned: number;
  extracted: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  durationMs: number;
}

export async function runProjectPipeline(opts: {
  triggeredBy: "cron" | "admin";
  limit?: number;
}): Promise<ProjectRunResult> {
  const limit = opts.limit ?? 12;
  const started = Date.now();
  let scanned = 0,
    extracted = 0,
    inserted = 0,
    updated = 0,
    skipped = 0,
    failed = 0;

  // Pull recent articles that have not been scanned yet. Prioritise categories
  // most likely to describe real projects.
  const { data: articles, error } = await supabaseAdmin
    .from("articles")
    .select(
      "id,headline,summary,content,why_it_matters,source_url,source_name,region,category,tags",
    )
    .is("project_extraction_at", null)
    .in("category", ["deals", "breaking", "analysis", "policy", "technology"])
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  for (const a of (articles ?? []) as ArticleRow[]) {
    scanned += 1;
    try {
      const data = await extractFromArticle(a);
      if (!data.is_project || !data.name) {
        await supabaseAdmin
          .from("articles")
          .update({ project_extraction_at: new Date().toISOString(), project_extraction_status: "not_a_project" })
          .eq("id", a.id);
        skipped += 1;
        continue;
      }
      extracted += 1;

      const region = (data.region ?? (a.region as Region | null) ?? "global") as Region;
      const defaults = regionDefaults(region);
      const slugBase = slugify(`${data.name} ${data.grid ?? region}`);
      const slug = slugBase || slugify(`${data.name} ${a.id.slice(0, 6)}`);

      // Check existing by slug.
      const { data: existing } = await supabaseAdmin
        .from("projects")
        .select("id, source_urls")
        .eq("slug", slug)
        .maybeSingle();

      const sourceUrls = Array.from(
        new Set([...(existing?.source_urls ?? []), a.source_url].filter(Boolean)),
      );

      const baseFields = {
        name: data.name,
        developer: data.developer ?? "Unknown",
        owner: data.owner,
        operator: data.operator,
        offtaker: data.offtaker,
        capacity_mw: data.capacity_mw ?? 0,
        capacity_mwh: data.capacity_mwh ?? (data.capacity_mw ?? 0) * 2,
        chemistry: data.chemistry,
        technology: data.technology ?? (data.chemistry ? `${data.chemistry} BESS` : "Lithium-ion BESS"),
        location: data.location ?? data.grid ?? defaults.country,
        country: data.country ?? defaults.country,
        region,
        status: data.status ?? "Announced",
        cod: data.cod ?? "TBD",
        use_case: data.use_case,
        source_urls: sourceUrls,
        last_verified_at: new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        source_type: "rss" as const,
        verification_status: "unverified" as const,
      };

      if (existing) {
        const { error: updErr } = await supabaseAdmin
          .from("projects")
          .update(baseFields)
          .eq("id", existing.id);
        if (updErr) {
          failed += 1;
          console.error("project update failed:", updErr.message);
        } else {
          updated += 1;
        }
      } else {
        const { error: insErr } = await supabaseAdmin.from("projects").insert({
          ...baseFields,
          slug,
          external_id: `rss-${slug}`.slice(0, 80),
          lat: defaults.lat,
          lng: defaults.lng,
          description: a.summary ?? null,
        });
        if (insErr) {
          if (insErr.message.toLowerCase().includes("duplicate")) {
            skipped += 1;
          } else {
            failed += 1;
            console.error("project insert failed:", insErr.message);
          }
        } else {
          inserted += 1;
        }
      }

      await supabaseAdmin
        .from("articles")
        .update({
          project_extraction_at: new Date().toISOString(),
          project_extraction_status: existing ? "updated" : "inserted",
        })
        .eq("id", a.id);
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("extract failed for article", a.id, msg);
      await supabaseAdmin
        .from("articles")
        .update({
          project_extraction_at: new Date().toISOString(),
          project_extraction_status: `error: ${msg.slice(0, 120)}`,
        })
        .eq("id", a.id);
    }
  }

  return { scanned, extracted, inserted, updated, skipped, failed, durationMs: Date.now() - started };
}
