# Linked workload review

## Research and decisions

- Vega-Lite selection guidance describes shared selection driving highlighting
  across coordinated views: https://vega.github.io/vega-lite/docs/selection.html.
  Apply that pattern with existing React state, not another chart package.
- WAI button guidance requires native keyboard operation and exposed pressed state:
  https://www.w3.org/WAI/ARIA/apg/patterns/button/.
- Retain readable nonmatching rows, add an explicit Highlighted label and inset
  accent, preserve both themes and the shared time cursor. Do not encode selection
  only in color or invent a validated schedule.

## Implementation phases

1. Reuse workloadDecisionGroup and matchesReviewGroup for both queue and timeline;
   no new backend, eligibility rules or calculation stores.
2. Reveal all assessed jobs (including protected) when the show-all control or
   chart-view buttons are activated. Bound larger imports to 50 rows per page,
   with the separately inspected job retained when outside the current page.
3. Review group activation reveals and highlights matching windows, opens the
   existing queue filter, scrolls to and focuses the labelled timeline region.
   Other rows stay visible; highlighted members sort first. Clear highlighting
   restores all-decision context without hiding windows. Queue dropdown also drives
   highlights without moving keyboard focus unexpectedly.
4. Validate selectors for partition correctness, large/empty sets, pagination and
   immutability. Validate keyboard group activation, protected rows, clearing,
   preserved cursor/numbers, chart modes and dark/light mobile/desktop screenshots.
   Run existing Compute interaction/accessibility tests. Keep heavy local work
   sequential under the resource guard; complete broad regression in CI.
5. Commit to a fresh branch from production main; require full exact-artifact CI,
   then merge and verify production identity and health. No database changes or
   parked PR #37 work.

## Recovery checkpoint

The implementation and tests were saved before the workstation restart. The first
unit-test launch was blocked by the RAM guard at 299 MB available; no unit test
actually started. Following the restart, use GitHub CI for all tests, typechecks,
linting, builds and browser validation in this release. Do not run local formatting
or validation tools, start a preview server, or raise worker/heap limits to bypass
the workstation pressure. Basic file inspection, patches and Git operations only.
