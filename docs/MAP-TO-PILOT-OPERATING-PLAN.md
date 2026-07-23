# Map-to-pilot operating plan

## Product outcome

GridPulse should help a large-load customer move from public grid context to a documented operator decision. The map is the entry point; written operator evidence remains controlling.

## End-to-end journey

1. **Discover:** Search a bounded Power Finder viewport and inspect source authority, mapped voltage, likely operator, operational context, and any explicitly published capacity evidence.
2. **Shortlist:** Save the complete feature and scoring snapshot. Re-saving the same source feature updates rather than duplicates the user's record.
3. **Create a private case:** Carry the location, name, project type, source feature identifier, and truth boundary into the project intake.
4. **Compare:** Attach other saved nodes or industrial sites to the project. Compare operator, voltage, distance, evidence authority, capacity state, and context completeness.
5. **Select:** Mark one candidate preferred only with a written rationale. This decision does not claim capacity.
6. **Prepare:** Complete technical inputs, required evidence, profiles, connection scenarios, and the versioned submission package.
7. **Engage:** Record the responsible operator, submission, correspondence, requests for information, written response, reinforcement, cost, timing, and offer/reservation deadlines.
8. **Decide:** Capture an immutable decision snapshot and produce the management and operator reports.
9. **Learn:** Record append-only pilot observations. Aggregate only completed, consented, customer-confirmed final outcomes.

## Implemented product modules

| Capability                 | Implementation                                            | Evidence boundary                               |
| -------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| Infrastructure discovery   | Power Finder viewport, search, filters and map            | Public/open mapping context                     |
| Operator evidence          | Source documents, matches and expert review queue         | Reviewed match does not imply capacity          |
| Shortlisting               | `power_finder_shortlists`                                 | Full source snapshot retained                   |
| Project conversion         | `attach_shortlist_candidate`                              | Exact shortlist ownership required              |
| Multi-candidate comparison | `project_connection_candidates`                           | Context score is not probability                |
| Preferred route            | `set_preferred_connection_candidate`                      | Mandatory rationale and one preferred candidate |
| Application preparation    | Requirements, documents, profiles, scenarios and packages | Versioned project evidence                      |
| Operator execution         | Engagement state machine, correspondence and deadlines    | Written response controls conclusions           |
| Collaboration              | Project roles, invitations and activity ledger            | Project-scoped access                           |
| Alerts                     | Persistent inbox and email-ready delivery ledger          | Delivery status remains explicit                |
| Management output          | Portfolio metrics, project reports and PDFs               | Unknown values remain unknown                   |
| Pilot learning             | Append-only observations and consented benchmarks         | Customer confirmation required                  |

## Brandenburg/E.DIS pilot procedure

1. Create a named customer case with an authorised decision owner.
2. Save at least two Power Finder candidates in Brandenburg.
3. Attach both to the case and document why one is preferred.
4. Confirm E.DIS responsibility for the exact address; do not rely only on geographic screening.
5. Complete the operator requirements register and generate submission package version 1.
6. Capture the `operator_submission` decision snapshot.
7. Record every operator interaction and information request.
8. Attach the written operator response and record indicated MW, reinforcement, cost, timing and limitations.
9. Capture the `operator_response` snapshot and management decision.
10. At project completion, obtain customer confirmation and explicit anonymised-case permission before benchmark inclusion.

## Release gates

- No candidate labelled with available MW unless directly supported by scoped operator evidence.
- Every map-derived project retains its immutable source snapshot.
- A preferred candidate requires a rationale.
- Submission packages remain versioned.
- Capacity, cost and timing claims expose their evidence state.
- Benchmarks exclude unconfirmed or non-consented pilots.
