import { Link } from "@tanstack/react-router";
import { LockKeyhole, CheckCircle2, Circle } from "lucide-react";
import { AppShell, PageHeading } from "./AppShell";

export function CapabilityPrerequisite({
  eyebrow,
  title,
  description,
  requirements,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  requirements: string[];
  children?: React.ReactNode;
}) {
  return (
    <AppShell>
      <main id="main-content" className="section-page">
        <PageHeading eyebrow={eyebrow} title={title} description={description} />
        {children}
        <section
          className="data-panel capability-prerequisite"
          aria-labelledby="prerequisite-title"
        >
          <LockKeyhole aria-hidden="true" />
          <div>
            <h2 id="prerequisite-title">What this stage requires</h2>
            <p>
              This stage is part of the GridPulse workflow, but it is not enabled for this public
              workspace. Nothing has been submitted or activated.
            </p>
            <ul>
              {requirements.map((item, index) => (
                <li key={item}>
                  {index < 2 ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
                  {item}
                </li>
              ))}
            </ul>
            <div className="button-row">
              <Link to="/power-finder" className="primary-button">
                Continue screening
              </Link>
              <Link to="/data-sources" className="secondary-button">
                Review data and methodology
              </Link>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
