import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, ExternalLink, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { downloadJson } from "@/features/grid-connection/deliverables";
import { buildValidationCase } from "@/lib/validation-case";

export const Route = createFileRoute("/validation-case")({
  head: () => ({
    meta: [
      { title: "GridPulse Validation Case | German Data-Centre Connection Options" },
      {
        name: "description",
        content:
          "A reproducible synthetic German data-centre case demonstrating evidence-backed connection option modelling without capacity claims.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: ValidationCasePage,
});

function ValidationCasePage() {
  const [canExport, setCanExport] = useState(false);
  const validation = useMemo(() => buildValidationCase(), []);
  useEffect(() => setCanExport(true), []);
  return (
    <PublicLayout>
      <main id="main-content" className="validation-case-page">
        <header className="validation-case-hero">
          <p>Reproducible validation / {validation.truth.methodologyVersion}</p>
          <h1>One synthetic German case. Four inspectable connection options.</h1>
          <p>{validation.truth.disclaimer}</p>
          <div>
            <button
              type="button"
              disabled={!canExport}
              onClick={() => downloadJson("gridpulse-de-validation-case.json", validation)}
            >
              <Download /> Download review artifact
            </button>
            <Link to="/pilot">
              Bring a real case <ExternalLink />
            </Link>
          </div>
        </header>

        <section className="validation-truth" aria-label="Declared project inputs">
          <article>
            <small>Requested import</small>
            <strong>80 MW</strong>
          </article>
          <article>
            <small>Minimum viable import</small>
            <strong>55 MW</strong>
          </article>
          <article>
            <small>Profile</small>
            <strong>35,040 intervals</strong>
          </article>
          <article>
            <small>Evidence state</small>
            <strong>Customer hypothesis</strong>
          </article>
        </section>

        <section className="validation-section">
          <header>
            <p>01 / Candidate locations</p>
            <h2>Separate maturity from network capacity.</h2>
          </header>
          <div className="validation-candidate-grid">
            {validation.candidates.map((candidate) => (
              <article key={candidate.name}>
                <small>{candidate.region}</small>
                <h3>{candidate.name}</h3>
                <p>{candidate.likelyContext}</p>
                <dl>
                  <div>
                    <dt>Land</dt>
                    <dd>{candidate.maturity.land}</dd>
                  </div>
                  <div>
                    <dt>Planning</dt>
                    <dd>{candidate.maturity.planning}</dd>
                  </div>
                  <div>
                    <dt>Route</dt>
                    <dd>{candidate.maturity.route}</dd>
                  </div>
                </dl>
                <p className="validation-warning">
                  <ShieldAlert /> {candidate.blocker}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="validation-section" data-testid="connection-options">
          <header>
            <p>02 / Connection options</p>
            <h2>Operational fit is not confirmation of grid feasibility.</h2>
          </header>
          <div className="validation-option-grid">
            {validation.options.map((option) => (
              <article key={option.kind} data-option={option.kind}>
                <small>{option.evidenceStatus.replaceAll("_", " ")}</small>
                <h3>{option.title}</h3>
                <strong>{option.operationalStatus.replaceAll("_", " ")}</strong>
                <dl>
                  <div>
                    <dt>Initial import</dt>
                    <dd>{option.initialImportMw} MW</dd>
                  </div>
                  <div>
                    <dt>Restricted hours</dt>
                    <dd>{option.analysis?.restrictedHours ?? "Not tested"}</dd>
                  </div>
                  <div>
                    <dt>Events</dt>
                    <dd>{option.analysis?.restrictionEvents ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Residual energy</dt>
                    <dd>{option.analysis?.residualUnservedMwh ?? "—"} MWh</dd>
                  </div>
                </dl>
                <details>
                  <summary>Questions for the operator</summary>
                  <ul>
                    {option.operatorQuestions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        </section>

        <section className="validation-section validation-review">
          <header>
            <p>03 / Independent review</p>
            <h2>What an expert must challenge before pilot use.</h2>
          </header>
          <ol>
            {validation.reviewQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
          <p>
            Passing this demonstration does not validate a real connection. A real pilot requires
            current project evidence and responsible-network-operator review.
          </p>
        </section>
      </main>
    </PublicLayout>
  );
}
