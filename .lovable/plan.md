# Slice 4: News Aggregation Pipeline

Automated pipeline that pulls energy/grid news from RSS feeds on a schedule, summarizes each article with AI, and stores results for display in the app.

## What gets built

1. **Sources & articles schema**
   - `news_sources` — RSS feed URLs (name, url, category, active flag)
   - `news_articles` — fetched items (source_id, title, url unique, published_at, raw_excerpt, ai_summary, ai_tags[], ai_impact_score, status)
   - RLS: authenticated users can SELECT; service role writes. Seed ~6 default grid/energy feeds (e.g. Utility Dive, GTM, EIA Today in Energy).

2. **Ingestion server function** (`src/utils/news-ingest.functions.ts`)
   - For each active source: fetch RSS XML, parse with `fast-xml-parser`, upsert new articles on `url` conflict (skip dupes), cap to N latest per run.

3. **AI summarization server function** (`src/utils/news-summarize.functions.ts`)
   - Query unsummarized articles, call Lovable AI Gateway (`google/gemini-2.5-flash`) with a structured prompt → returns `{summary, tags[], impact_score 1-10}`.
   - Update rows; mark `status='ready'` or `'failed'`.

4. **Public cron endpoint** (`src/routes/api/public/news/run.ts`)
   - POST handler verifies `x-cron-secret` header against `CRON_SECRET`, runs ingest then summarize, returns counts.
   - Schedule via pg_cron (hourly) hitting the stable preview/published URL.

5. **Feed UI** (`src/routes/_authenticated/feed.tsx`)
   - List of summarized articles with title, source, published time, AI summary, tags, impact badge. Filters by category/tag. Pagination.
   - Free tier sees latest 10; Pro/Enterprise see full feed + filters (gated via `useSubscription`).
   - Add nav link from settings/dashboard.

6. **Manual "Run now" button** on an admin/debug area (admin role only) for testing without waiting on cron.

## Technical notes

- AI: Lovable AI Gateway, no key needed. Handle 429/402 explicitly.
- Cron secret stored via `add_secret` tool.
- All writes via `supabaseAdmin` inside the cron route (verified by header secret).
- Idempotent: unique `url` constraint + `ON CONFLICT DO NOTHING`.

## Out of scope (later slices)

- Email digests, user-saved articles, custom source subscriptions, push notifications.

Confirm to proceed, or tell me what to adjust (sources list, free-tier limit, schedule frequency).
