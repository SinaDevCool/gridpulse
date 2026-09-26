# Power Finder Release 5 — operator evidence and discrepancy control

Release 5 productizes the existing private Phase 5 operator-engagement workflow. It does not
interpret a synthetic statement as an operator response and cannot create mapped capacity.

## Delivered

- The reproducible acceptance command calls the same extraction, discrepancy and restriction
  functions used by the authenticated assessment workspace.
- Extracted German or English terms remain machine-highlighted drafts until compared with a linked
  source document by a human.
- Customer declarations and reviewed operator values remain separate. Conflicts are recorded
  instead of silently overwriting either value.
- Restriction events calculate required, delivered and residual response as non-operational
  rehearsals. They do not issue telemetry, BMS, EMS or workload-control commands.
- Authenticated grid-expert approval requires the source document and content hash before the
  private workflow can atomically create an operator-proposed envelope.
- Ordinary editors can create and revise draft/reviewed evidence, but RLS prevents them from setting
  `operator_confirmed` or directly creating `operator_proposed`/`agreed` envelopes. The protected
  approval function verifies the exact operator-source document ID and SHA-256, preserved declared
  values and discrepancies, valid non-negative limits and the authenticated grid-expert role.
- Validity dates are extracted as reviewable drafts and carried into the proposed envelope only after
  approval. Invalid numeric inputs and invalid validity windows fail closed.
- The public governance artifact contains benchmark summaries only. Correspondence text, document
  identifiers, reviewer identity and private project records are excluded.
- Every reference-network result carries the Release 5 governance checksum for export lineage, but
  Release 5 does not change its MW values or promote it onto the OpenStreetMap grid.
- Public reproducibility includes the acceptance command and benchmark-input hash; raw text, document
  identifiers, reviewer identity and project records remain private.

## Run the acceptance benchmark

```powershell
npm run grid:validate:r5
```

The bundled case intentionally contains a conflicting import limit and an insufficient response.
Passing means the product exposes both the discrepancy and the residual; it does not mean the
connection or operating strategy passed.

## Remaining operator dependency

Mapped capacity still requires a real operator source, reviewed scope and validity, authenticated
approval, operator signature, accepted node/model reconciliation and explicit capacity-
representation permission. Until those gates pass, `display_as_capacity` and
`operator_confirmation_created` remain false.
