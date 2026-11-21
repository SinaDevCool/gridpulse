# Dependency security qualification — November 2026

The production audit initially reported 11 affected dependency nodes: three high, seven
moderate and one low. These are dependency advisory findings, not evidence that an exploit
occurred. No advisory was suppressed and no forced audit fix was used.

## Changes

- Vite minimum updated to 8.3.8 within major version 8.
- Zod updated to 4.6.7. The unused TanStack Zod adapter was removed. Forty-six single-argument
  record declarations across six modules now provide an explicit string key schema. The pilot
  consent message uses the current error option. Numerical model coefficients are unchanged.
- DOMPurify override now requires at least 3.4.18; Seroval requires at least 1.8.2.
- The workbook writer moved to 4.1.1, removing the archiver/glob dependency chain. Browser
  exports use its documented browser entry and toFile API. A real XLSX download/read-back
  regression checks German characters rather than mocking the export call.
- Sector project-type links now use the actual data_centre/electrolyser contract values.
- Browser validation caught Zod 4 errors no longer satisfying native instanceof Error.
  Facility, battery, workload and telemetry imports now display their specific validation
  issues while preserving accepted evidence. The existing invalid-import browser regression
  passes after the correction.
- Selected infrastructure details load on demand, with focus applied after the panel mounts.
  The existing 500000-byte Finder route budget is retained.
- A subsequent audit including development dependencies found 11 additional affected nodes:
  one high and ten moderate, in Undici/Miniflare and the TypeScript ESLint chain. Updated
  @cloudflare/vite-plugin to 1.70.1, Wrangler to 4.164.0 and typescript-eslint to 8.73.0,
  within their existing major versions. No transitive major-version override was needed.
- Wrangler is pinned to the Vite plugin's own matching 4.164.0 version. Windows Application
  Control blocked the newer 4.166.0 November 19 runtime; the November 17 runtime supplied by
  4.164.0 runs normally and retains a clean full audit. No policy, security setting or binary
  verification was bypassed. Seven compiled Worker contract checks pass with the pinned toolchain.

## References

- Zod collection memory exhaustion and patched version: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- Zod migration guide: https://zod.dev/v4/changelog
- Glob cancellation issue: https://github.com/advisories/GHSA-3g3m-2fjr-6pw4
- Vite middleware issue and patched release lines: https://github.com/advisories/GHSA-9jrq-w75r-8gcw
- Workbook migration: the installed write-excel-file README contains the 2→3 and 3→4 guides.
- Minimatch pattern amplification: https://github.com/advisories/GHSA-g3hv-75wg-m249
- Undici redirect/cache issue: https://github.com/advisories/GHSA-4w7w-5xrc-9h26

After final lockfile regeneration, npm audit --audit-level=high (including development tools) reported zero
vulnerabilities. Validation after dependency changes is recorded in
FINDER-AUDIT-IMPLEMENTATION.md. This is a dated audit result, not a promise that future
advisories cannot affect the same dependency set.
