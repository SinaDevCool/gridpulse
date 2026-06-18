// Server-only: RSS ingestion + AI summarization pipeline.
import { XMLParser } from "fast-xml-parser";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

const ALLOWED_CATEGORIES = [
  "breaking",
  "analysis",
  "deals",
  "policy",
  "technology",
  "safety",
  "markets",
] as const;
type Category = (typeof ALLOWED_CATEGORIES)[number];

interface RssItem {
  title: string;
  url: string;
  publishedAt: string | null;
  excerpt: string;
  author: string | null;
}

interface AiSummary {
  headline: string;
  summary: string;
  why_it_matters: string;
  category: Category;
  tags: string[];
  region: string;
  is_breaking: boolean;
  read_minutes: number;
}

interface SourceRow {
  id: string;
  name: string;
  feed_url: string;
  category: string;
}

function slugify(s: string, fallback: string): string {
  const base = (s || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/^-|-$/g, "");
  return base || fallback;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function stripHtml(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchRss(feedUrl: string): Promise<RssItem[]> {
  const res = await fetch(feedUrl, {
    headers: {
      "user-agent": "GridPulseBot/1.0 (+https://gridpulse.app)",
      accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Feed ${feedUrl} returned ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const doc = parser.parse(xml);

  // RSS 2.0
  const rssItems = doc?.rss?.channel?.item;
  if (rssItems) {
    const arr = Array.isArray(rssItems) ? rssItems : [rssItems];
    return arr
      .map((it: Record<string, unknown>): RssItem | null => {
        const url = (it.link as string) || "";
        const title = stripHtml((it.title as string) || "");
        if (!url || !title) return null;
        const description = stripHtml(
          (it["content:encoded"] as string) || (it.description as string) || ""
        );
        const pub = (it.pubDate as string) || (it["dc:date"] as string) || null;
        return {
          title,
          url,
          publishedAt: pub ? new Date(pub).toISOString() : null,
          excerpt: description.slice(0, 1500),
          author: (it["dc:creator"] as string) || (it.author as string) || null,
        };
      })
      .filter((x): x is RssItem => x !== null);
  }

  // Atom
  const atomEntries = doc?.feed?.entry;
  if (atomEntries) {
    const arr = Array.isArray(atomEntries) ? atomEntries : [atomEntries];
    return arr
      .map((it: Record<string, unknown>): RssItem | null => {
        const linkRaw = it.link;
        let url = "";
        if (Array.isArray(linkRaw)) {
          const alt = linkRaw.find((l: Record<string, unknown>) => l["@_rel"] !== "self");
          url = (alt?.["@_href"] as string) || "";
        } else if (typeof linkRaw === "object" && linkRaw) {
          url = ((linkRaw as Record<string, unknown>)["@_href"] as string) || "";
        }
        const title = stripHtml(
          typeof it.title === "string" ? it.title : ((it.title as Record<string, unknown>)?.["#text"] as string) || ""
        );
        if (!url || !title) return null;
        const summary = stripHtml(
          (it.summary as string) ||
            ((it.content as Record<string, unknown>)?.["#text"] as string) ||
            (it.content as string) ||
            ""
        );
        const pub = (it.published as string) || (it.updated as string) || null;
        const authorObj = it.author as Record<string, unknown> | undefined;
        return {
          title,
          url,
          publishedAt: pub ? new Date(pub).toISOString() : null,
          excerpt: summary.slice(0, 1500),
          author: (authorObj?.name as string) || null,
        };
      })
      .filter((x): x is RssItem => x !== null);
  }

  return [];
}

async function summarize(item: RssItem, sourceName: string): Promise<AiSummary> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const system = `You are a senior energy-storage industry analyst writing for GridPulse, a publication covering grid-scale battery storage, energy markets, and policy. Produce concise, accurate summaries with sharp "why it matters" framing. Return ONLY JSON matching the schema. No markdown, no preamble.`;

  const user = `Source: ${sourceName}
Title: ${item.title}
URL: ${item.url}
Excerpt:
${item.excerpt}

Return JSON with these exact keys:
{
  "headline": string (max 110 chars, rewritten for clarity),
  "summary": string (2-3 sentences, ~300 chars),
  "why_it_matters": string (1-2 sentences explaining significance to grid-storage industry),
  "category": one of ${ALLOWED_CATEGORIES.map((c) => `"${c}"`).join(", ")},
  "tags": string[] (3-6 lowercase tags, e.g. "lithium-iron-phosphate","ercot","tax-credits"),
  "region": one of "north-america","europe","asia-pacific","middle-east","africa","latin-america","global",
  "is_breaking": boolean (true ONLY for major time-sensitive news),
  "read_minutes": integer 1-8
}`;

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("AI rate limit (429) — try again later");
  if (res.status === 402) throw new Error("AI credits exhausted (402) — top up Lovable credits");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as Partial<AiSummary>;

  const category: Category = ALLOWED_CATEGORIES.includes(parsed.category as Category)
    ? (parsed.category as Category)
    : "analysis";

  return {
    headline: (parsed.headline || item.title).slice(0, 200),
    summary: (parsed.summary || item.excerpt.slice(0, 280)).slice(0, 600),
    why_it_matters: parsed.why_it_matters || "Adds context to ongoing grid-storage market activity.",
    category,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8).map((t) => String(t).toLowerCase()) : [],
    region: parsed.region || "global",
    is_breaking: Boolean(parsed.is_breaking),
    read_minutes: Math.max(1, Math.min(15, Number(parsed.read_minutes) || 3)),
  };
}

export interface RunResult {
  runId: string;
  fetched: number;
  inserted: number;
  summarized: number;
  failed: number;
  durationMs: number;
}

export async function runNewsPipeline(opts: {
  triggeredBy: "cron" | "admin";
  perFeedLimit?: number;
  totalLimit?: number;
}): Promise<RunResult> {
  const perFeedLimit = opts.perFeedLimit ?? 8;
  const totalLimit = opts.totalLimit ?? 20;
  const startedAt = Date.now();

  const { data: run, error: runErr } = await supabaseAdmin
    .from("ingestion_runs")
    .insert({ triggered_by: opts.triggeredBy, status: "running" })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(`Failed to create run: ${runErr?.message}`);
  const runId = run.id;

  let fetched = 0;
  let inserted = 0;
  let summarized = 0;
  let failed = 0;

  try {
    const { data: sources, error: srcErr } = await supabaseAdmin
      .from("news_sources")
      .select("id,name,feed_url,category")
      .eq("active", true);
    if (srcErr) throw srcErr;

    const candidates: { src: SourceRow; item: RssItem }[] = [];

    for (const src of (sources ?? []) as SourceRow[]) {
      try {
        const items = await fetchRss(src.feed_url);
        fetched += items.length;
        for (const it of items.slice(0, perFeedLimit)) candidates.push({ src, item: it });
        await supabaseAdmin
          .from("news_sources")
          .update({ last_run_at: new Date().toISOString(), last_status: "ok", last_error: null })
          .eq("id", src.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabaseAdmin
          .from("news_sources")
          .update({ last_run_at: new Date().toISOString(), last_status: "error", last_error: msg })
          .eq("id", src.id);
      }
    }

    // Filter out URLs we already have
    const urls = candidates.map((c) => c.item.url);
    if (urls.length === 0) {
      await supabaseAdmin
        .from("ingestion_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "ok",
          fetched_count: fetched,
          inserted_count: 0,
          summarized_count: 0,
          failed_count: 0,
        })
        .eq("id", runId);
      return { runId, fetched, inserted: 0, summarized: 0, failed: 0, durationMs: Date.now() - startedAt };
    }
    const { data: existing } = await supabaseAdmin
      .from("articles")
      .select("source_url")
      .in("source_url", urls);
    const seen = new Set((existing ?? []).map((r) => r.source_url));
    const fresh = candidates.filter((c) => !seen.has(c.item.url)).slice(0, totalLimit);

    for (const { src, item } of fresh) {
      try {
        const ai = await summarize(item, src.name);
        summarized += 1;
        const slug = slugify(ai.headline, item.url.split("/").pop() || crypto.randomUUID().slice(0, 8));
        const { error: insErr } = await supabaseAdmin.from("articles").insert({
          slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
          headline: ai.headline,
          summary: ai.summary,
          content: item.excerpt,
          why_it_matters: ai.why_it_matters,
          category: ai.category,
          source_name: src.name,
          source_domain: domainOf(item.url),
          source_url: item.url,
          author: item.author || src.name,
          read_minutes: ai.read_minutes,
          verified: false,
          is_breaking: ai.is_breaking,
          tags: ai.tags,
          region: ai.region,
          also_reported_by: [],
          related_project_ids: [],
          published_at: item.publishedAt || new Date().toISOString(),
        });
        if (insErr) {
          // Unique-violation = race; not a failure.
          if (!insErr.message.includes("duplicate")) {
            failed += 1;
            console.error("Insert error:", insErr.message);
          }
        } else {
          inserted += 1;
        }
      } catch (e) {
        failed += 1;
        console.error("Summarize/insert failed:", e);
      }
    }

    await supabaseAdmin
      .from("ingestion_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: failed > 0 && inserted === 0 ? "error" : "ok",
        fetched_count: fetched,
        inserted_count: inserted,
        summarized_count: summarized,
        failed_count: failed,
      })
      .eq("id", runId);

    return { runId, fetched, inserted, summarized, failed, durationMs: Date.now() - startedAt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("ingestion_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "error",
        error: msg,
        fetched_count: fetched,
        inserted_count: inserted,
        summarized_count: summarized,
        failed_count: failed,
      })
      .eq("id", runId);
    throw e;
  }
}
