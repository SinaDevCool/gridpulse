# Validation pipeline implementation

## Goals and boundaries

Fail early on changed Operations behavior, retain full cross-product release coverage,
and deploy only the exact artifact validated for the current commit. No database,
calculation-engine, hosting-plan or parked PR #37 changes.

## Phases

1. Correct historical-import assertions: historical URL, visible scenario/read-only
   boundary, discoverable no-command explanation, absent dispatch action. Run this
   test alone before moving it.
2. Move Operations evidence/onboarding tests out of Finder. Put cross-solution
   navigation in a shared suite. Declare all browser specs in one ownership manifest,
   including explicitly non-release legacy specs. Check missing/duplicate ownership.
3. Define a fast gate (history, battery, shared assessment). Run it before broad
   Operations/Finder/shared jobs; exclude fast specs from the subsequent broad run.
4. Use a shared browser runner with one worker, bounded global timeout, per-suite
   HTML/JSON/trace/screenshot directories and a GitHub timing/failure summary.
5. Reuse one validation workflow from PR and production triggers. Cancel superseded
   PR runs. Build the production candidate once for the exact event SHA; upload only
   dist and a SHA/run/hash manifest. Verify hashes before runtime validation and
   again before publishing. Never promote an arbitrary PR or older-run artifact.
6. Run Operations, Finder and shared jobs in a remote matrix with max-parallel=2.
   Keep local jobs sequential, unit workers<=2, browser workers=1. Retain standalone
   solution isolation builds as separate non-deployable validation fixtures.
7. Gate deployment on every required validation job. Serialize publishing without
   cancelling an in-progress publish; reject a stale main SHA immediately before
   publishing. No rebuild in the deployment job. Confirm live build SHA and health.

## Acceptance

- Focused history check passes; ownership and artifact-tamper tests pass.
- No release spec is lost; fast specs execute once per validation workflow.
- Browser failures retain downloadable reports and traces.
- A changed file, missing artifact file, wrong SHA or wrong run blocks deployment.
- PRs cannot access deployment credentials; production credentials are only present
  in the final publishing step. Full regression remains mandatory before publishing.
- Measure CI wall time after rollout; do not promise a particular runtime or cost.
