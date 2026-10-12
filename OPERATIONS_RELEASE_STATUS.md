# Operations calculation integrity release

This release improves the existing three-tab application. It is **not completion of the complete operational-planning roadmap**. No real facility model, live connector, dispatch authority, or customer tariff has been invented.

## Delivered

- Battery dispatch conserves interval energy and respects import headroom. Energy/ramp conflicts are explicit rather than hidden by SOC clamping.
- GPU power aggregates concurrent devices before averaging time intervals; duplicate device samples do not double count power.
- Scenario comparisons include baseline, battery, workload-only and combined alternatives. Deferred energy is recovered within the configured delay where headroom exists; unrecovered energy makes the illustrative alternative infeasible.
- Compute and battery uploads survive tab switching. Scenario changes invalidate cached compute assessments; stale asynchronous import responses are discarded.
- Server assessments include an input fingerprint, assessment ID and calculation version. These IDs identify a calculation, not a saved approval.
- Historical battery alignment uses one shared alignment implementation.
- Response economics require complete interval series and prices. Deferred energy is not automatically treated as avoided cost; capacity-charge savings require reviewed billing evidence.
- Canonical request preparation fails closed without an explicit reviewed physical model, policy, profiles and prices. The existing canonical workbench is reused, not a second optimisation stack.
- UI presents unresolved recovery obligations, illustrative confidence and reference GPU-hour equivalents without claiming delivered compute or dispatch verification.

## Roadmap status and remaining work

| Phase | Status |
| --- | --- |
| 1. Calculation ownership | Existing canonical engine retained; scenario demonstrator explicitly separate. |
| 2. Canonical adapter | Unsafe inferred request removed; reviewed-contract gate delivered. Automatic evidenced workspace-to-model mapping remains to implement and validate. |
| 3. Assessment lifecycle | Identity and stale-result invalidation delivered; persisted approval-to-assessment linkage remains. |
| 4. Battery physics | Demonstrator conservation and conflict checks delivered; reviewed UPS/transformer/reserve-policy integration remains. |
| 5. Workloads | Whole-job selection and aggregate recovery checks delivered; actual job-level canonical schedules are not integrated into the three-tab dashboard. |
| 6. Alternatives and economics | Four illustrative alternatives and full-horizon economic checks delivered; canonical comparable alternatives need reviewed model and tariff integration. |
| 7. UI | Three tabs retained, progressive disclosure and evidence wording improved; browser tests cover light/dark and desktop/mobile. |
| 8. Review persistence | Existing database infrastructure retained; saved operational review workflow is not implemented in this release. |
| 9. Replay and replanning | Existing canonical workbench exposed; dashboard replay, continuous authenticated ingestion and automatic read-only replanning remain. |

## Required before an operational pilot

1. Reviewed facility/equipment and battery models, job throughput/power profiles, reserve/recovery policy and tariff data.
2. An authenticated reachable canonical analytics service and authorised facility workspace.
3. End-to-end integration and benchmark tests on those contracts; missing inputs must keep the product in scenario mode.
4. Persisted review ownership/version rules, then historical replay acceptance, then read-only live ingestion. Physical dispatch requires a separate authorised integration.

No production operational capability should be claimed from synthetic scenario validation alone.
