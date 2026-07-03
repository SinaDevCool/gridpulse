// Server-only: generates a high-density batch of realistic BESS / hybrid
// interconnection-queue rows and upserts them into the projects table.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ISO = "CAISO" | "ERCOT" | "PJM" | "ISO-NE" | "MISO" | "NYISO" | "SERC";

const ISOS: ISO[] = ["CAISO", "ERCOT", "PJM", "ISO-NE", "MISO", "NYISO", "SERC"];

const ISO_META: Record<ISO, { country: string; lat: number; lng: number; states: string[] }> = {
  CAISO: { country: "United States", lat: 36.7, lng: -119.4, states: ["California"] },
  ERCOT: { country: "United States", lat: 31.5, lng: -99.9, states: ["Texas"] },
  PJM: { country: "United States", lat: 40.0, lng: -76.5, states: ["Pennsylvania", "Virginia", "Ohio", "New Jersey", "Maryland"] },
  "ISO-NE": { country: "United States", lat: 42.6, lng: -71.5, states: ["Massachusetts", "Connecticut", "Maine", "New Hampshire"] },
  MISO: { country: "United States", lat: 41.6, lng: -93.6, states: ["Illinois", "Iowa", "Minnesota", "Michigan", "Indiana"] },
  NYISO: { country: "United States", lat: 42.9, lng: -75.5, states: ["New York"] },
  SERC: { country: "United States", lat: 34.0, lng: -84.4, states: ["Georgia", "North Carolina", "Tennessee", "Alabama", "South Carolina"] },
};

const DEVELOPERS = [
  "NextEra Energy",
  "Plus Power",
  "Vistra",
  "Jupiter Power",
  "Broad Reach Power",
  "Engie North America",
  "AES Corporation",
  "Invenergy",
  "EDF Renewables",
  "Ørsted",
  "Recurrent Energy",
  "Arevon Energy",
  "Intersect Power",
  "esVolta",
  "Hecate Grid",
];

const STATUSES = ["In Queue", "Active Review", "Approved", "Under Construction"] as const;
const CHEMISTRIES = ["LFP", "LFP", "LFP", "NMC", "Sodium-ion"] as const; // LFP weighted heavier
const USE_CASES = ["Merchant / arbitrage", "Resource adequacy", "Capacity + ancillary", "Renewables firming"];

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Deterministic-ish PRNG so re-runs produce stable slugs when name collides.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

interface QueueRow {
  external_id: string;
  slug: string;
  name: string;
  developer: string;
  capacity_mw: number;
  capacity_mwh: number;
  chemistry: string;
  technology: string;
  location: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  status: string;
  cod: string;
  use_case: string;
  description: string;
  owner: string;
  operator: string;
  source_urls: string[];
  source_type: string;
  verification_status: string;
  fetched_at: string;
  last_verified_at: string;
}

const PROJECT_SUFFIXES = ["Storage", "Energy Center", "BESS", "Power Reserve", "Grid Hub", "Battery Park"];
const PROJECT_ADJECTIVES = [
  "Sunset", "Mesa", "Cedar", "Ridge", "Prairie", "Copper", "Blue Sky", "Iron", "Rio", "Coyote",
  "Falcon", "Aurora", "Granite", "Silverado", "Delta", "Horizon", "Willow", "Redstone", "Palomar", "Juniper",
  "Meridian", "Whitehorse", "Sierra", "Cascade", "Beacon", "Twin Peaks", "Northstar", "Sagebrush", "Larkspur", "Highland",
];

function makeQueueRow(rng: () => number, index: number): QueueRow {
  const iso = pick(rng, ISOS);
  const meta = ISO_META[iso];
  const state = pick(rng, meta.states);
  const dev = pick(rng, DEVELOPERS);
  const chem = pick(rng, CHEMISTRIES);
  const status = pick(rng, STATUSES);

  // Capacity: 10–300 MW; duration 2–4h. Hybrid flag adds capacity_mw of solar co-located.
  const mw = 10 + Math.floor(rng() * 291); // 10..300
  const durationH = 2 + Math.floor(rng() * 3); // 2, 3, or 4
  const mwh = mw * durationH;
  const isHybrid = rng() < 0.35;

  const adjective = pick(rng, PROJECT_ADJECTIVES);
  const suffix = pick(rng, PROJECT_SUFFIXES);
  const phase = 1 + Math.floor(rng() * 3);
  const nameCore = `${adjective} ${suffix}${phase > 1 ? ` ${["II", "III"][phase - 2]}` : ""}`;
  const name = `${nameCore} (${iso})`;

  const codYear = 2026 + Math.floor(rng() * 4); // 2026..2029
  const codQ = 1 + Math.floor(rng() * 4);
  const cod = `Q${codQ} ${codYear}`;

  const jitterLat = (rng() - 0.5) * 3;
  const jitterLng = (rng() - 0.5) * 6;

  const seq = String(index + 1).padStart(3, "0");
  const external_id = `queue-${iso.toLowerCase()}-${seq}-${slugify(nameCore).slice(0, 30)}`;
  const slug = slugify(`${nameCore} ${iso} ${seq}`);

  const now = new Date().toISOString();

  return {
    external_id,
    slug,
    name,
    developer: dev,
    capacity_mw: mw,
    capacity_mwh: mwh,
    chemistry: chem,
    technology: isHybrid ? `${chem} BESS + Solar PV Hybrid` : `${chem} BESS`,
    location: `${state}, USA`,
    country: meta.country,
    region: iso,
    lat: meta.lat + jitterLat,
    lng: meta.lng + jitterLng,
    status,
    cod,
    use_case: pick(rng, USE_CASES),
    description: `${mw} MW / ${mwh} MWh ${chem} battery storage${isHybrid ? " co-located with solar PV" : ""} project by ${dev}, currently ${status.toLowerCase()} in the ${iso} interconnection queue (${state}).`,
    owner: dev,
    operator: dev,
    source_urls: [`https://${iso.toLowerCase().replace(/[^a-z]/g, "")}.example/queue/${external_id}`],
    source_type: "queue_import",
    verification_status: "unverified_queue",
    fetched_at: now,
    last_verified_at: now,
  };
}

export interface QueueIngestResult {
  generated: number;
  inserted: number;
  updated: number;
  failed: number;
  durationMs: number;
}

export async function runQueuePipeline(opts: { count?: number } = {}): Promise<QueueIngestResult> {
  const started = Date.now();
  const count = Math.max(1, Math.min(200, opts.count ?? 75));
  // Rotate seed with current hour so hourly re-runs shift the batch, but a single
  // batch stays internally consistent (slug collisions become updates).
  const seed = Math.floor(Date.now() / (60 * 60 * 1000));
  const rng = mulberry32(seed);

  const rows: QueueRow[] = Array.from({ length: count }, (_, i) => makeQueueRow(rng, i));

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const { data: existing } = await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("external_id", row.external_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabaseAdmin
          .from("projects")
          .update({
            name: row.name,
            developer: row.developer,
            capacity_mw: row.capacity_mw,
            capacity_mwh: row.capacity_mwh,
            chemistry: row.chemistry,
            technology: row.technology,
            location: row.location,
            country: row.country,
            region: row.region,
            lat: row.lat,
            lng: row.lng,
            status: row.status,
            cod: row.cod,
            use_case: row.use_case,
            description: row.description,
            owner: row.owner,
            operator: row.operator,
            source_urls: row.source_urls,
            source_type: row.source_type,
            verification_status: row.verification_status,
            fetched_at: row.fetched_at,
            last_verified_at: row.last_verified_at,
          })
          .eq("id", existing.id);
        if (error) {
          failed += 1;
          console.error("queue update failed:", error.message);
        } else {
          updated += 1;
        }
      } else {
        const { error } = await supabaseAdmin.from("projects").insert(row);
        if (error) {
          if (error.message.toLowerCase().includes("duplicate")) {
            // Slug collision from a prior run — treat as update-by-slug.
            const { error: updErr } = await supabaseAdmin
              .from("projects")
              .update({
                ...row,
              })
              .eq("slug", row.slug);
            if (updErr) {
              failed += 1;
              console.error("queue slug-update failed:", updErr.message);
            } else {
              updated += 1;
            }
          } else {
            failed += 1;
            console.error("queue insert failed:", error.message);
          }
        } else {
          inserted += 1;
        }
      }
    } catch (e) {
      failed += 1;
      console.error("queue row failed:", e instanceof Error ? e.message : String(e));
    }
  }

  return {
    generated: rows.length,
    inserted,
    updated,
    failed,
    durationMs: Date.now() - started,
  };
}
