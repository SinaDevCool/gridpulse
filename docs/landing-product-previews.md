# Landing product previews

The homepage and solution introductions share solution identities and availability from
src/config/solutions.ts and presentation copy from src/config/solution-content.ts.
They import static previews only; no map, solver or authentication runs on the homepage.

Finder previews retain the existing mapped screening images. Operations previews come
from an accepted hosted synthetic SciPy/HiGHS MILP calculation, rendered without changing
the returned numerical result. They illustrate the product, not customer telemetry,
promised savings, additional connection capacity or physical dispatch.

Refresh Operations previews by manually dispatching MILP frontend focused qualification
with capture_marketing enabled. This submits one bounded synthetic job and captures all
three tabs from that same result. Regular PR checks never submit a hosted marketing job.
Review the images and provenance artifact before copying WebP files to public/landing.
Desktop image budgets are 250 KB each; mobile is 100 KB.

The landing page, public navigation and introductions filter the existing enabled
solutions. Neither service requires a project from the other. Public application entry
links remain /power-finder and /operations. Introduction pages explain the independent
workflows. Site portfolio is part of Site Selection, not a third service.

Release boundary: feature branch only. No merge, deployment, schema or solver change.
