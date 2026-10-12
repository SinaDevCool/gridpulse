# Neo4j workspace UI integration

## Purpose

The Neo4j integration helps an authenticated pilot team inspect topology, alternative connection pathways,
scenario coverage, evidence quality, model history, and portfolio overlap. It does **not** turn public map data
into available grid capacity. Public Power Finder remains a screening product, while private graph intelligence is
shown only inside an authorised site assessment.

## Delivery phases

### D-UI0 — contract and truth boundary

- `private_graph_workspace_ui(site_id)` is the single, sanitised read contract for the browser.
- The RPC checks the signed-in user and site access before finding the associated operator workspace.
- Raw graph tables remain service-role only; the anonymous and public roles cannot execute the RPC.
- Every response states `capacity_claim: false` and includes prohibited interpretations.
- Empty, stale, unaccepted, and unavailable models fail closed instead of falling back to synthetic claims.

### D-UI1 — pathway exploration

- A selected candidate can expose bounded alternative topology paths.
- The primary path is paired with an ordered asset table; switching an alternative updates both views.
- The graphical view is a small native SVG, not an unbounded graph-browser query.
- Path labels and copy distinguish topology traces from electrical feasibility or capacity.

### D-UI2 — scenarios and physics evidence

- Scenario-generation coverage, preserved mandatory cases, candidate reduction, and recall are visible.
- Physics attachments show solver/check provenance and constraint summaries only when linked to the model.
- UI states distinguish accepted topology, physics-verified evidence, and missing electrical models.

### D-UI3 — history, quality, portfolio, and sovereignty

- Version hashes, snapshots, deltas, and a virtualised event timeline support audit review.
- Quality checks and metrics expose why a model is ready or incomplete.
- Portfolio overlap is presented as an operational conflict signal, not as reserved capacity.
- The panel states the workspace region, tenant isolation policy, and query limits.

### D-UI4 — accessibility, performance, and operations

- Tabs, tables, SVG descriptions, visible keyboard focus, semantic status messages, and WCAG Axe checks are used.
- The expert graph is lazy-loaded, and the potentially long event list is virtualised.
- `VITE_PRIVATE_GRAPH_UI=false` is the emergency frontend rollback switch.
- An anonymous security check covers both raw graph tables and the private UI RPC.

## Data flow

1. A graph-guided qualification is submitted without a workspace binding; caller-supplied workspace
   IDs and promoted-mode policies are rejected at the public analytics boundary.
2. The Python study service publishes an unlinked, private topology result and provenance record.
3. An operator reviewer uses the protected database workflow to attach the study to a real pilot
   workspace with current topology-processing permission.
4. Promotion additionally requires a passed reconciliation, linked operator review, complete
   mandatory/constraint recall and zero false-safe outcomes.
5. Supabase returns a sanitised, site-scoped view to an authenticated assessment user.
6. React renders an explicit state and never infers capacity from topology.

Existing studies without a workspace association intentionally remain invisible. They must be republished or
linked through an approved migration rather than guessed from geographic proximity.

## Pilot acceptance states

- **No workspace:** the site is not part of an operator pilot.
- **No model:** an authorised workspace exists, but no accepted graph study is linked.
- **Model accepted:** bounded topology and audit evidence are available.
- **Physics verified:** the accepted topology also has linked solver evidence.
- **Stale:** a model exists but is outside its declared freshness policy.
- **Error:** access or contract validation failed; no partial graph data are rendered.

## Verification

Run from the repository root:

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e:finder
npm run security:public-finder
npm run grid:validate:neo4j
```

For the Python service:

```powershell
$env:PYTHONPATH=(Resolve-Path 'services/grid-data/src').Path
python -m pytest -q services/grid-data/tests
python -m ruff check services/grid-data/src services/grid-data/tests
```
