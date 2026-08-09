const baseUrl = (process.env.GRIDPULSE_HEALTH_BASE_URL ?? "https://gridpulseinsights.com").replace(
  /\/$/,
  "",
);
const checks = [
  {
    name: "public-home",
    url: `${baseUrl}/`,
    expectedStatus: 200,
    validate: async (response) => {
      const html = await response.text();
      if (/Power Activation|Power Operations|dispatch engine|Start a Pilot/i.test(html)) {
        throw new Error("landing page promises a capability outside the Finder MVP");
      }
      if (!html.includes("sina.khedmati@outlook.de")) {
        throw new Error("Finder contact email is missing");
      }
    },
  },
  {
    name: "public-power-finder",
    url: `${baseUrl}/power-finder`,
    expectedStatus: 200,
    validate: async (response) => {
      const html = await response.text();
      if (!html.includes("Power Finder")) throw new Error("Finder heading is missing");
      if (/Sign In|Sign Up|Create account/i.test(html)) {
        throw new Error("Finder unexpectedly exposes account access");
      }
    },
  },
  {
    name: "methodology",
    url: `${baseUrl}/data-sources`,
    expectedStatus: 200,
    validate: async (response) => {
      const html = await response.text();
      if (/Product Tour|Start a Pilot|Review the Assessment/i.test(html)) {
        throw new Error("methodology exposes a deferred product workflow");
      }
    },
  },
  {
    name: "release-a-synthetic-methodology",
    url: `${baseUrl}/power-finder/release-a-synthetic-methodology.json`,
    expectedStatus: 200,
    validate: async (response) => {
      const payload = await response.json();
      if (
        payload?.evidence_status !== "synthetic" ||
        payload?.not_for_connection_decision !== true
      ) {
        throw new Error("Release A methodology is missing its synthetic evidence boundary");
      }
    },
  },
  {
    name: "experimental-scenario-api-disabled",
    url: `${baseUrl}/api/power-finder/scenario`,
    expectedStatus: 404,
    options: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project: {
          name: "Release health check",
          type: "data_centre",
          importMw: 20,
          ultimateImportMw: 30,
          exportMw: 0,
          minimumFirmMw: 15,
          flexibleLoadMw: 5,
          targetEnergisationYear: 2030,
          preferredVoltageKv: 110,
          redundancy: "dual_feed",
          loadProfile: "flat",
          annualConsumptionGwh: 150,
          maxInterruptionHours: 2,
          annualInterruptionLimit: 10,
          batteryPowerMw: 0,
          batteryEnergyMwh: 0,
          batteryRoundTripEfficiencyPct: 88,
          batteryReservePct: 10,
          onsiteGenerationMw: 0,
        },
        candidates: [
          {
            id: "health-candidate",
            nodeId: "health-node",
            voltageKv: [110],
            distanceKm: 3,
            contextScore: 70,
            evidenceScore: 60,
          },
        ],
      }),
    },
    validate: async (response) => {
      const payload = await response.json();
      if (
        payload?.validatedStudyAvailable !== false ||
        !String(payload?.error ?? "").includes("disabled for the public MVP")
      ) {
        throw new Error("experimental scenario API is not safely disabled");
      }
    },
  },
  {
    name: "release-b-network-methodology",
    url: `${baseUrl}/power-finder/release-b-network-methodology.json`,
    expectedStatus: 200,
    validate: async (response) => {
      const payload = await response.json();
      if (
        payload?.evidence_status !== "synthetic" ||
        payload?.validation_status !== "unvalidated_reference_model" ||
        payload?.not_for_connection_decision !== true
      ) {
        throw new Error("Release B methodology lost its synthetic validation boundary");
      }
    },
  },
  {
    name: "public-finder-viewport",
    url: `${baseUrl}/api/power-finder/viewport?west=12.9&south=52.1&east=13.8&north=52.6&generation=true&storage=true`,
    expectedStatus: 200,
    validate: async (response) => {
      const payload = await response.json();
      const available = payload?.metadata?.available_kinds ?? [];
      for (const kind of ["node", "line", "industrial_site", "generation_asset", "storage_asset"]) {
        if (!available.includes(kind)) {
          throw new Error(`public Finder viewport is missing ${kind}`);
        }
      }
      if (!Array.isArray(payload?.features) || payload.features.length === 0) {
        throw new Error("public Finder viewport returned no features");
      }
    },
  },
  {
    name: "invalid-public-finder-bounds",
    url: `${baseUrl}/api/power-finder/viewport?west=0&south=0&east=30&north=60`,
    expectedStatus: 400,
  },
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
      if (payload?.metadata?.parser_version !== "osm-geojson-v2-voltage-units") {
        throw new Error("accepted release is not using the voltage-unit-safe parser");
      }
      const invalidVoltage = payload.features.find((feature) =>
        (feature?.properties?.voltage_kv ?? []).some((voltage) => voltage > 500),
      );
      if (invalidVoltage) {
        throw new Error(`implausible voltage remains on ${invalidVoltage.id}`);
      }
    },
  },
  {
    name: "invalid-finder-query-safe",
    url: `${baseUrl}/power-finder?lat=60&lng=99&mw=2000`,
    expectedStatus: 200,
    validate: async (response) => {
      const html = await response.text();
      if (!html.includes("Power Finder") || html.includes("Something went wrong")) {
        throw new Error("malformed Finder query did not degrade safely");
      }
    },
  },
  { name: "auth-disabled", url: `${baseUrl}/auth`, expectedStatus: 404 },
  { name: "portfolio-disabled", url: `${baseUrl}/portfolio`, expectedStatus: 404 },
  { name: "assessments-disabled", url: `${baseUrl}/assessments/new`, expectedStatus: 404 },
];

const results = [];
let failed = false;

for (const check of checks) {
  const startedAt = performance.now();
  try {
    const response = await fetch(check.url, {
      ...check.options,
      headers: check.options?.headers ?? check.headers,
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
