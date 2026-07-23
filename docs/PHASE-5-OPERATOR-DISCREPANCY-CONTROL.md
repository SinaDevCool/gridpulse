# Phase 5 — operator discrepancy control

Phase 5 extends the existing operator-engagement workflow. Extracted facts remain
linked to the source document, require human review, and require an authenticated
grid-expert approval before they can create an operator-proposed envelope.

The workflow now compares reviewed operator facts with customer declarations and
classifies each field as confirmed, conflicting, or missing operator evidence.
Conflicts preserve both values and instruct the reviewer to resolve the
difference; they never silently overwrite project inputs.

The comparison is a review aid, not OCR authority, legal interpretation, a
connection offer, or permission to operate.
