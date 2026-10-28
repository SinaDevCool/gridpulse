import type { z } from "zod";
import type { guidanceSchema } from "./guidance-contracts";

type Guidance = z.infer<typeof guidanceSchema>;
/** Shared presentation; source content and applicability remain server-owned. */
export function GuidanceReferences({ references, describedIds = [] }: {
  references: Guidance[]; describedIds?: string[];
}) {
  if (!references.length) return null;
  return <details className="ops-guidance-references">
    <summary>Report guidance & sources · {references.length}</summary>
    <p>Editorial guidance. Site measurements and engineering review are still required.</p>
    {references.map(item => <section className="ops-guidance-reference" key={item.id}>
      <h4>{item.title}</h4>
      {!describedIds.includes(item.id) ? <p>{item.text}</p> : null}
      {item.applicability ? <p>{item.applicability}</p> : null}
      <a href={item.source.endsWith(".pdf") && item.pdfPages?.length ? `${item.source}#page=${item.pdfPages[0]}` : item.source}
        target="_blank" rel="noreferrer">Read source: {item.title}{item.pdfPages?.length ? ` · PDF pages ${item.pdfPages.join(", ")}` : ""}</a>
      {item.requiredInputs?.length ? <details><summary>Evidence needed for site use</summary><ul>{item.requiredInputs.map(value => <li key={value}>{value.replaceAll("_", " ")}</li>)}</ul></details> : null}
      {item.excludedUses?.length ? <div className="ops-guidance-exclusions"><strong>Excluded uses</strong><ul>{item.excludedUses.map(value => <li key={value}>{value.replaceAll("_", " ")}</li>)}</ul></div> : null}
      <details><summary>Source version & integrity</summary><dl>
        <div><dt>Revision</dt><dd>{item.revision ?? item.version}</dd></div>
        {item.sourceContentHash ? <div><dt>Source SHA-256</dt><dd translate="no">{item.sourceContentHash}</dd></div> : null}
        {item.reviewedAt ? <div><dt>Editorial review</dt><dd>{item.reviewedAt}</dd></div> : null}
      </dl></details>
    </section>)}
  </details>;
}
