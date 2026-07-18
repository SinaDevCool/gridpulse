import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState, type ReactElement, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pilot")({
  head: () => ({
    meta: [
      { title: "Request a GridPulse Pilot | German Grid Connection Assessment" },
      {
        name: "description",
        content:
          "Apply for a GridPulse design-partner pilot for a German BESS, data-centre or large-load grid connection case.",
      },
      { property: "og:title", content: "Request a GridPulse Pilot" },
      { property: "og:url", content: "https://gridpulseinsights.com/pilot" },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/pilot" }],
  }),
  component: PilotApplication,
});

const optionalNumber = z.preprocess(
  (value) => (value === "" || value == null ? null : Number(value)),
  z.number().min(0).max(1_000_000).nullable(),
);

const schema = z
  .object({
    contactName: z.string().trim().min(2).max(120),
    workEmail: z.string().trim().email().max(254),
    company: z.string().trim().min(2).max(160),
    roleTitle: z.string().trim().max(120),
    phone: z.string().trim().max(40),
    projectName: z.string().trim().min(2).max(160),
    projectType: z.enum(["bess", "data_centre", "large_load", "co_location", "other"]),
    projectStage: z.enum([
      "site_screening",
      "pre_application",
      "application_submitted",
      "operator_dialogue",
      "other",
    ]),
    postcode: z.string().regex(/^\d{5}$/, "Enter a five-digit German postcode"),
    municipality: z.string().trim().min(2).max(160),
    federalState: z.string().trim().min(2).max(80),
    importMw: z.coerce.number().min(0).max(100_000),
    exportMw: z.coerce.number().min(0).max(100_000),
    batteryPowerMw: optionalNumber,
    batteryEnergyMwh: optionalNumber,
    targetConnectionDate: z.string(),
    connectionChallenge: z.string().trim().min(20).max(3000),
    consent: z.literal(true, { errorMap: () => ({ message: "Consent is required" }) }),
    website: z.string().max(0),
  })
  .refine((values) => values.importMw > 0 || values.exportMw > 0, {
    message: "Enter an import or export requirement",
    path: ["importMw"],
  });

type PilotForm = z.infer<typeof schema>;

const states = [
  "Baden-Württemberg",
  "Bavaria",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hesse",
  "Lower Saxony",
  "Mecklenburg-Vorpommern",
  "North Rhine-Westphalia",
  "Rhineland-Palatinate",
  "Saarland",
  "Saxony",
  "Saxony-Anhalt",
  "Schleswig-Holstein",
  "Thuringia",
];

function PilotApplication() {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PilotForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectType: "bess",
      projectStage: "site_screening",
      importMw: 0,
      exportMw: 0,
      roleTitle: "",
      phone: "",
      targetConnectionDate: "",
      website: "",
    },
  });
  const projectType = watch("projectType");
  const includesBattery = projectType === "bess" || projectType === "co_location";

  async function submit(values: PilotForm) {
    setSubmitError("");
    const { error } = await supabase.from("pilot_requests").insert({
      contact_name: values.contactName,
      work_email: values.workEmail.toLowerCase(),
      company: values.company,
      role_title: values.roleTitle || null,
      phone: values.phone || null,
      project_name: values.projectName,
      project_type: values.projectType,
      project_stage: values.projectStage,
      postcode: values.postcode,
      municipality: values.municipality,
      federal_state: values.federalState,
      requested_import_mw: values.importMw,
      requested_export_mw: values.exportMw,
      battery_power_mw: includesBattery ? values.batteryPowerMw : null,
      battery_energy_mwh: includesBattery ? values.batteryEnergyMwh : null,
      target_connection_date: values.targetConnectionDate || null,
      connection_challenge: values.connectionChallenge,
      consent_to_contact: values.consent,
      website: values.website,
    });
    if (error) {
      setSubmitError("We could not submit your request. Please try again or contact us directly.");
      return;
    }
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (submitted) {
    return (
      <main className="pilot-page pilot-confirmation">
        <section>
          <div className="pilot-success-icon">
            <Check />
          </div>
          <h1>Your project is in the review queue.</h1>
          <p>
            Thank you. We will review the connection case and contact you about fit, required
            evidence and a practical pilot scope.
          </p>
          <div className="pilot-next-steps">
            <span>
              <b>1</b> Fit and scope review
            </span>
            <span>
              <b>2</b> Evidence request
            </span>
            <span>
              <b>3</b> Pilot kickoff
            </span>
          </div>
          <div className="pilot-confirmation-actions">
            <Link to="/demo" className="landing-button primary">
              Explore the product demo
            </Link>
            <Link to="/" className="pilot-text-link">
              Return to GridPulse
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="pilot-page">
      <header className="pilot-topbar">
        <Link to="/" className="landing-brand">
          <span>GRID</span>
          <strong>PULSE</strong>
        </Link>
        <Link to="/" className="pilot-text-link">
          <ArrowLeft /> Back to GridPulse
        </Link>
      </header>
      <div className="pilot-layout">
        <aside className="pilot-intro">
          <h1>Bring us one real connection case.</h1>
          <p>
            GridPulse design-partner pilots turn fragmented project and operator evidence into a
            traceable pre-feasibility assessment.
          </p>
          <div className="pilot-assurance">
            <ShieldCheck />
            <div>
              <b>What happens with your information</b>
              <span>We use it only to assess pilot fit and contact you about this project.</span>
            </div>
          </div>
          <ul>
            <li>
              <Check /> BESS, data-centre and large-load projects in Germany
            </li>
            <li>
              <Check /> Evidence and uncertainty remain visible
            </li>
            <li>
              <Check /> No claim of available network capacity
            </li>
          </ul>
        </aside>
        <form className="pilot-form" onSubmit={handleSubmit(submit)} noValidate>
          <FormSection number="01" title="Your details">
            <div className="pilot-form-grid">
              <Field label="Full name" error={errors.contactName?.message}>
                <input autoComplete="name" {...register("contactName")} />
              </Field>
              <Field label="Work email" error={errors.workEmail?.message}>
                <input type="email" autoComplete="email" {...register("workEmail")} />
              </Field>
              <Field label="Company" error={errors.company?.message}>
                <input autoComplete="organization" {...register("company")} />
              </Field>
              <Field label="Role (optional)" error={errors.roleTitle?.message}>
                <input autoComplete="organization-title" {...register("roleTitle")} />
              </Field>
              <Field label="Phone (optional)" error={errors.phone?.message}>
                <input type="tel" autoComplete="tel" {...register("phone")} />
              </Field>
            </div>
          </FormSection>
          <FormSection number="02" title="Project and location">
            <Field label="Project name" error={errors.projectName?.message}>
              <input {...register("projectName")} />
            </Field>
            <div className="pilot-form-grid">
              <Field label="Project type" error={errors.projectType?.message}>
                <select {...register("projectType")}>
                  <option value="bess">Battery energy storage</option>
                  <option value="data_centre">Data centre</option>
                  <option value="large_load">Large electrical load</option>
                  <option value="co_location">Co-located BESS + load</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Development stage" error={errors.projectStage?.message}>
                <select {...register("projectStage")}>
                  <option value="site_screening">Site screening</option>
                  <option value="pre_application">Preparing application</option>
                  <option value="application_submitted">Application submitted</option>
                  <option value="operator_dialogue">In operator dialogue</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Postcode" error={errors.postcode?.message}>
                <input inputMode="numeric" maxLength={5} {...register("postcode")} />
              </Field>
              <Field label="Municipality" error={errors.municipality?.message}>
                <input {...register("municipality")} />
              </Field>
              <Field label="Federal state" error={errors.federalState?.message}>
                <select {...register("federalState")}>
                  <option value="">Select state</option>
                  {states.map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Target connection date (optional)"
                error={errors.targetConnectionDate?.message}
              >
                <input type="date" {...register("targetConnectionDate")} />
              </Field>
            </div>
          </FormSection>
          <FormSection number="03" title="Connection requirement">
            <div className="pilot-form-grid">
              <Field label="Requested import (MW)" error={errors.importMw?.message}>
                <input type="number" min="0" step="0.001" {...register("importMw")} />
              </Field>
              <Field label="Requested export (MW)" error={errors.exportMw?.message}>
                <input type="number" min="0" step="0.001" {...register("exportMw")} />
              </Field>
              {includesBattery ? (
                <>
                  <Field
                    label="Battery power (MW, optional)"
                    error={errors.batteryPowerMw?.message}
                  >
                    <input type="number" min="0" step="0.001" {...register("batteryPowerMw")} />
                  </Field>
                  <Field
                    label="Battery energy (MWh, optional)"
                    error={errors.batteryEnergyMwh?.message}
                  >
                    <input type="number" min="0" step="0.001" {...register("batteryEnergyMwh")} />
                  </Field>
                </>
              ) : null}
            </div>
            <Field
              label="What is blocking or delaying the connection decision?"
              error={errors.connectionChallenge?.message}
            >
              <textarea
                rows={5}
                placeholder="Describe the operator feedback, evidence gaps, connection options or commercial question you need to resolve."
                {...register("connectionChallenge")}
              />
            </Field>
          </FormSection>
          <div className="pilot-form-submit">
            <label className={errors.consent ? "pilot-consent has-error" : "pilot-consent"}>
              <input type="checkbox" {...register("consent")} />
              <span>
                I agree that GridPulse may use this information to assess the pilot and contact me
                about this project.
              </span>
            </label>
            <div className="pilot-honeypot" aria-hidden="true">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" {...register("website")} />
              </label>
            </div>
            {submitError ? <p className="form-message error-message">{submitError}</p> : null}
            <button type="submit" className="landing-button primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoaderCircle className="spin" /> Submitting…
                </>
              ) : (
                <>
                  Submit pilot request <ArrowRight />
                </>
              )}
            </button>
            <small>
              Submitting a request does not create a connection offer or advisory engagement.
            </small>
          </div>
        </form>
      </div>
    </main>
  );
}

function FormSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="pilot-form-section">
      <header>
        <span>{number}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactElement;
}) {
  return (
    <label className={error ? "pilot-field has-error" : "pilot-field"}>
      <span>{label}</span>
      {children}
      {error ? <small>{error}</small> : null}
    </label>
  );
}
