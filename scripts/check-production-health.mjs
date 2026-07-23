const baseUrl = (process.env.GRIDPULSE_HEALTH_BASE_URL ?? "https://gridpulseinsights.com").replace(
  /\/$/,
  "",
);
const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const checks = [
  { name: "public-home", url: `${baseUrl}/`, expectedStatus: 200 },
  { name: "private-power-finder-shell", url: `${baseUrl}/power-finder`, expectedStatus: 200 },
  { name: "methodology", url: `${baseUrl}/data-sources`, expectedStatus: 200 },
  {
    name: "accepted-screening-release",
    url: `${baseUrl}/power-finder/brandenburg-osm.json`,
    expectedStatus: 200,
    validate: async (response) => {
      const payload = await response.json();
      if (payload?.metadata?.record_count !== 668) {
        throw new Error(
          `expected 668 accepted features, received ${payload?.metadata?.record_count}`,
        );
      }
      if (!String(payload?.metadata?.evidence_boundary).includes("Open mapping")) {
        throw new Error("accepted release lost its Open mapping evidence boundary");
      }
    },
  },
];

if (supabaseUrl && supabaseKey) {
  checks.push({
    name: "supabase-auth",
    url: `${supabaseUrl}/auth/v1/health`,
    expectedStatus: 200,
    headers: { apikey: supabaseKey },
  });
}

const results = [];
let failed = false;

for (const check of checks) {
  const startedAt = performance.now();
  try {
    const response = await fetch(check.url, {
      headers: check.headers,
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status !== check.expectedStatus) {
      throw new Error(`expected HTTP ${check.expectedStatus}, received ${response.status}`);
    }
    if (check.validate) await check.validate(response);
    results.push({
      name: check.name,
      status: "pass",
      http_status: response.status,
      elapsed_ms: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    failed = true;
    results.push({
      name: check.name,
      status: "fail",
      elapsed_ms: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

console.log(
  JSON.stringify(
    {
      checked_at: new Date().toISOString(),
      base_url: baseUrl,
      status: failed ? "fail" : "pass",
      checks: results,
    },
    null,
    2,
  ),
);

if (failed) process.exitCode = 1;
