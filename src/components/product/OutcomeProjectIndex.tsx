import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AppShell, PageHeading } from "./AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function OutcomeProjectIndex({
  eyebrow,
  title,
  description,
  destination,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  destination: "/activation/$id" | "/operations/$id";
  children?: React.ReactNode;
}) {
  const { user } = useAuth();
  const projects = useQuery({
    queryKey: ["outcome-project-index", destination, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_sites")
        .select("id,name,requested_import_mw,likely_network_operator,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page">
        <PageHeading eyebrow={eyebrow} title={title} description={description} />
        {children}
        <section className="data-panel" aria-labelledby="outcome-projects-title">
          <div className="section-toolbar"><div><h2 id="outcome-projects-title">Projects</h2></div><span>{projects.data?.length ?? 0} available</span></div>
          <div className="table-scroll"><table className="product-table"><thead><tr><th>Project</th><th>Requested import</th><th>Likely operator</th><th>Workflow</th></tr></thead><tbody>
            {projects.isLoading ? <tr><td colSpan={4}>Loading projects…</td></tr> : projects.error ? <tr><td colSpan={4}>Unable to load projects.</td></tr> : !projects.data?.length ? <tr><td colSpan={4}>Create or save a site before opening this workflow.</td></tr> : projects.data.map((project) => (
              <tr key={project.id}><td><b>{project.name || "Untitled project"}</b></td><td>{project.requested_import_mw} MW</td><td>{project.likely_network_operator || "Unconfirmed"}</td><td><Link to={destination} params={{ id: project.id }}>Open</Link></td></tr>
            ))}
          </tbody></table></div>
        </section>
      </main>
    </AppShell>
  );
}
