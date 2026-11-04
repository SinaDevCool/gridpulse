# Pipeline release controls

## Implemented candidate

Workflow file names stay stable to preserve callers and links. Display names identify CI, Release, Operations and Data responsibilities.

* Application PR checks keep the existing mandatory MILP, browser, artifact and isolation gates.
* Database changes trigger disposable PostgreSQL/PostGIS qualification without hosted database credentials.
* Production deployment is manual, protected by the `production` environment, serialized with `gridpulse-production-mutation`, and requires a successful manually dispatched staging run for exactly the same application SHA.
* Staging uses `gridpulse-staging-mutation`, keeps its artifacts for 30 days, and checks a live freeze policy immediately before publishing.
* Both publish paths fail closed if the live freeze variable cannot be read or is anything other than the literal `false`.
* Scheduled source monitoring no longer publishes operator health or ingests SMARD into production. Independent observations continue after another observation fails; failure evidence uploads regardless of the outcome.
* Legacy auth, Render configuration and database application jobs are disabled. Their read-only qualification remains available. These jobs must not be re-enabled as a bypass.

## GitHub setup before enabling these workflows

1. In both `staging` and `production`, create environment variable `DEPLOYMENT_FREEZE=true` initially.
2. Restrict deployment branches to `main`. Require an independent reviewer for production where the repository plan supports it.
3. Create a fine-grained read-only policy token with access to this repository's Actions variables and workflow runs. Save it as environment secret `RELEASE_POLICY_READ_TOKEN` in each environment. It must not have deployment or repository write permission.
4. Move deployment credentials and environment-specific public configuration into their corresponding environments. A workflow environment is not proof that repository-level credentials have been scoped correctly.
5. Review required check names before changing branch protection. Keep current required job checks until replacements have passed on a pull request.
6. Set staging freeze to `false`, dispatch staging from main with a change reference, and record the successful run ID.
7. Dispatch production from the same main SHA with that staging run ID and change reference. Approve only after reviewing the environment and run evidence.

The production candidate still receives its own environment-specific build and regression validation. This is exact-source promotion, not byte-for-byte promotion of the staging bundle. Publishing itself never rebuilds a bundle.

## Freeze rehearsal

Use staging first. Set `DEPLOYMENT_FREEZE=true`, dispatch a release and confirm the guard fails before the Wrangler deploy step. The currently running Worker continues serving traffic. Set it to `false`, rerun and confirm deployment succeeds. Also test deleting the variable: this must block deployment. CI remains enabled throughout. A freeze does not stop a deployment which has already passed its final guard; cancel that run separately if necessary.

## Remaining architecture work

This candidate does not yet implement paired engine promotion, versioned release manifests, cross-run production artifact promotion, automated rollback, Terraform import/plan/apply, hosted schema application, synthetic-data cleanup, action SHA pinning or a security scanning workflow. Those are separate unfinished phases, not capabilities provided by this change.

Infrastructure adoption requires an inventory/import review first. Never apply Terraform or a Render Blueprint against existing resources solely by matching names. Database changes and the parked PR #37 require separate explicit authorization. Recovery must verify database compatibility before rolling application code back. Until those checks exist, use the documented provider recovery process with an incident record.

## Validation

Run `node --test scripts/release-guard.test.mjs scripts/validation-workflow.test.mjs` and the repository's resource-safe checks before review. GitHub-hosted qualification and a staging freeze rehearsal are still required; local parsing does not establish that hosted credentials or protection rules are configured.
