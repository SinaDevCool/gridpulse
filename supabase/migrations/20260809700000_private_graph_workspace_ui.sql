-- Private, assessment-scoped UI contract for Neo4j Groups A-D.
-- Raw graph tables stay service-role only; authenticated participants receive
-- a bounded, redacted JSON projection after the assessment permission check.

create or replace function public.private_graph_workspace_ui(p_site_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  workspace public.operator_pilot_workspaces%rowtype;
  study public.grid_topology_studies%rowtype;
  v_model_key text;
  policy jsonb;
begin
  if auth.uid() is null or not public.can_read_assessment(p_site_id) then
    raise exception 'Access denied';
  end if;

  select * into workspace
  from public.operator_pilot_workspaces
  where site_id = p_site_id;

  if not found then
    return jsonb_build_object(
      'schema_version', 'gridpulse-private-graph-ui-v1',
      'state', 'no_workspace',
      'site_id', p_site_id,
      'capacity_claim', false
    );
  end if;

  select * into study
  from public.grid_topology_studies
  where workspace_id = workspace.id
  order by created_at desc
  limit 1;

  select coalesce(jsonb_build_object(
    'permitted_regions', permitted_regions,
    'purposes', purposes,
    'retention_days', retention_days,
    'allow_model_training', allow_model_training,
    'allow_raw_export', allow_raw_export,
    'policy_sha256', policy_sha256,
    'active', active
  ), '{}'::jsonb) into policy
  from public.grid_graph_workspace_policies
  where workspace_id = workspace.id and active
  order by created_at desc limit 1;

  if study.id is null then
    return jsonb_build_object(
      'schema_version', 'gridpulse-private-graph-ui-v1',
      'state', 'no_model',
      'site_id', p_site_id,
      'workspace', jsonb_build_object(
        'id', workspace.id,
        'status', workspace.status,
        'validation_class', workspace.validation_class,
        'real_operator_pilot', workspace.real_operator_pilot
      ),
      'policy', coalesce(policy, '{}'::jsonb),
      'capacity_claim', false
    );
  end if;

  v_model_key := study.model_id || ':' || study.model_version;

  return jsonb_build_object(
    'schema_version', 'gridpulse-private-graph-ui-v1',
    'state', case
      when exists(select 1 from public.grid_graph_physics_attachments a where a.model_key=v_model_key and a.stale) then 'stale'
      when exists(select 1 from public.grid_graph_physics_attachments a where a.model_key=v_model_key and a.physics_verified and not a.stale) then 'physics_verified'
      else 'model_accepted'
    end,
    'site_id', p_site_id,
    'workspace', jsonb_build_object(
      'id', workspace.id,
      'status', workspace.status,
      'validation_class', workspace.validation_class,
      'real_operator_pilot', workspace.real_operator_pilot
    ),
    'model', jsonb_build_object(
      'model_id', study.model_id,
      'model_version', study.model_version,
      'projection_sha256', study.projection_sha256,
      'study_sha256', study.study_sha256,
      'status', study.status,
      'created_at', study.created_at,
      'capacity_claim', false
    ),
    'topology_audit', study.topology_audit,
    'pathways', study.pathway_summary,
    'scenario_coverage', study.scenario_selection || study.validation_summary,
    'physics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attachment_sha256', attachment_sha256,
        'payload', attachment_payload,
        'stale', stale,
        'created_at', created_at
      ) order by created_at desc)
      from public.grid_graph_physics_attachments where model_key=v_model_key
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'snapshot_id', snapshot_id,
        'projection_sha256', projection_sha256,
        'valid_from', valid_from,
        'valid_to', valid_to
      ) order by valid_from desc)
      from public.grid_graph_temporal_snapshots where model_key=v_model_key
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sequence', sequence,
        'occurred_at', occurred_at,
        'event_type', event_type,
        'asset_id', asset_id
      ) order by sequence desc)
      from (select * from public.grid_graph_topology_events where model_key=v_model_key order by sequence desc limit 100) e
    ), '[]'::jsonb),
    'deltas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'next_model_key', next_model_key,
        'delta_sha256', delta_sha256,
        'status', status,
        'summary', jsonb_build_object(
          'node_upserts', jsonb_array_length(coalesce(delta_payload->'node_upserts','[]'::jsonb)),
          'node_deletes', jsonb_array_length(coalesce(delta_payload->'node_deletes','[]'::jsonb)),
          'relationship_upserts', jsonb_array_length(coalesce(delta_payload->'relationship_upserts','[]'::jsonb)),
          'relationship_deletes', jsonb_array_length(coalesce(delta_payload->'relationship_deletes','[]'::jsonb))
        ),
        'created_at', created_at
      ) order by created_at desc)
      from public.grid_graph_projection_deltas where model_key=v_model_key
    ), '[]'::jsonb),
    'quality', coalesce((
      select jsonb_build_object(
        'metrics', metrics,
        'checks', checks,
        'accepted', accepted,
        'invalidate_physics_results', invalidate_physics_results,
        'quality_sha256', quality_sha256,
        'created_at', created_at
      ) from public.grid_graph_quality_runs where model_key=v_model_key order by created_at desc limit 1
    ), '{}'::jsonb),
    'portfolio', coalesce((
      select interaction_payload || jsonb_build_object(
        'portfolio_sha256', portfolio_sha256,
        'capacity_claim', false,
        'created_at', created_at
      ) from public.grid_graph_portfolio_interactions where model_key=v_model_key order by created_at desc limit 1
    ), '{}'::jsonb),
    'policy', coalesce(policy, '{}'::jsonb),
    'prohibited_interpretations', jsonb_build_array(
      'available grid capacity', 'connection probability', 'connection offer', 'delivery date'
    ),
    'capacity_claim', false
  );
end $$;

revoke all on function public.private_graph_workspace_ui(uuid) from public, anon;
grant execute on function public.private_graph_workspace_ui(uuid) to authenticated;
