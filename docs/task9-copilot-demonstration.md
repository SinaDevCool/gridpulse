# Task 9: GridPulse grounded plan copilot demonstration

## Scope and honest labels

The MILP engine supplies all calculation values. OpenAI selects supported findings;
application code inserts checked values, mandatory warnings and limitations. This is
synthetic decision support, not customer telemetry or equipment control.

Two kinds of evidence must stay clearly labelled:

- **Live integration:** `.codex-tmp/copilot-task9/` contains a real synthetic hosted
  96-interval calculation, its entered constraints, checked OpenAI brief/receipt and
  an explicit rejected unsupported-claim test. The HTTP bridge uses the production
  handler with a test limiter adapter; it is not a Cloudflare production deployment.
- **Browser qualification:** CI screenshots/export use the labelled display fixture
  and mocked provider response. They prove interaction, layout and review lifecycle;
  they must not be presented as another real solver/OpenAI execution.

The raw generated live brief deliberately says human review is not acknowledged.
Automated browser acknowledgement demonstrates the interface only; it is not a human
approval record. Do not fabricate a reviewer timestamp in the live evidence.

## Suggested 90-second walkthrough

1. **0–15s — Problem and constraints.** Explain that an energy manager must review
   power, workload deadlines and battery reserve together. Show entered-constraints.json
   and identify import limit, operating target, battery bounds and workload constraints.
2. **15–30s — Calculation.** Show the accepted job receipt: 96 intervals, solver status,
   result identity and physical replay acceptance. Retain 'feasible, not proven optimal'
   when that is the returned status.
3. **30–50s — Brief.** Show the live checked brief's Summary, Power, Workloads and Battery
   sections. Explain that the AI chooses finding IDs; it cannot replace numbers.
4. **50–65s — Grounding.** Expand a power evidence reference in the interface and show
   value/unit, full-horizon scope, raw value and source selector. Label fixture captures
   as UI qualification when using them instead of a live application session.
5. **65–75s — Negative case.** Show rejected-claim.json. 'Guaranteed savings' is an
   intentionally unsupported validation-test claim, not a provider statement.
6. **75–90s — Human review and export.** Demonstrate the review checkbox and text export.
   Explain that input/result changes invalidate the brief and that review does not
   authorise equipment control. Mention session-scoped storage and no database save.

## Evidence files

Live pack (local, ignored):
- entered-constraints.json
- accepted-calculation.json
- checked-brief.json and checked-brief.txt
- rejected-claim.json
- qualification.json

Browser artifacts in the existing focused qualification run:
- copilot-desktop-evidence.png
- copilot-mobile.png
- copilot-reviewed-receipt.png
- copilot-reviewed-export.txt

Use the newest successful run for the pushed candidate. Reports and failure traces
remain available through the existing workflow. Recording/submission and actual human
review are user actions; this change prepares their evidence without submitting anything.
