-- STABLE functions use the calling statement's MVCC snapshot for all reads.
-- Keep the caller JWT/RLS; never substitute service-role reads for workspace access.
create function public.operations_workspace_snapshot(p_facility_id uuid,p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare snapshot jsonb;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if p_start is null or p_end is null or p_start>=p_end or p_end>now() or p_end-p_start>interval '7 days' then
    raise exception using errcode='22023',message='Invalid evidence window'; end if;
  if not exists(select 1 from public.operations_facilities where id=p_facility_id and owner_id=auth.uid()) then
    return null; end if;
  select jsonb_build_object(
    'captured_at',statement_timestamp(),
    'operations_facilities',(select jsonb_agg(to_jsonb(f)) from public.operations_facilities f where id=p_facility_id and owner_id=auth.uid()),
    'operations_sources',(select coalesce(jsonb_agg(to_jsonb(t) order by t.display_name,t.id),'[]') from (select * from public.operations_sources where facility_id=p_facility_id order by display_name,id limit 1001) t),
    'operations_source_watermarks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.source_id),'[]') from (select * from public.operations_source_watermarks where facility_id=p_facility_id order by source_id limit 1001) t),
    'operations_measurements',(select coalesce(jsonb_agg(to_jsonb(t) order by t.event_at,t.id),'[]') from (select * from public.operations_measurements where facility_id=p_facility_id and quality='accepted' and event_at>=p_start and event_at<=p_end and received_at<=p_end order by event_at,id limit 15001) t),
    'operations_battery_assets',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from (select * from public.operations_battery_assets where facility_id=p_facility_id order by id limit 101) t),
    'operations_workloads',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from (select * from public.operations_workloads where facility_id=p_facility_id order by id limit 501) t),
    'operations_forecasts',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select * from public.operations_forecasts where facility_id=p_facility_id and promotion_status='accepted' and generated_at<=p_end and evidence_cutoff<=p_end order by generated_at desc,id desc limit 1) t),
    'operations_recommendations',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select * from public.operations_recommendations where facility_id=p_facility_id order by created_at desc,id desc limit 1) t),
    'operations_verifications',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select * from public.operations_verifications where facility_id=p_facility_id order by created_at desc,id desc limit 1) t),
    'operations_data_quality',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select * from public.operations_data_quality where facility_id=p_facility_id order by window_end desc,id desc limit 1) t),
    'operations_operating_agreements',(select coalesce(jsonb_agg(to_jsonb(t) order by t.valid_from desc,t.id),'[]') from (select * from public.operations_operating_agreements where facility_id=p_facility_id order by valid_from desc,id limit 101) t),
    'operations_calculation_runs',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id),'[]') from (select * from public.operations_calculation_runs where facility_id=p_facility_id order by created_at desc,id limit 10) t),
    'operations_dispatch_approvals',(select coalesce(jsonb_agg(to_jsonb(t) order by t.decision_at desc,t.id),'[]') from (select * from public.operations_dispatch_approvals where facility_id=p_facility_id order by decision_at desc,id limit 50) t)
  ) into snapshot;
  if jsonb_array_length(snapshot->'operations_sources')>1000
    or jsonb_array_length(snapshot->'operations_source_watermarks')>1000
    or jsonb_array_length(snapshot->'operations_measurements')>15000
    or jsonb_array_length(snapshot->'operations_battery_assets')>100
    or jsonb_array_length(snapshot->'operations_workloads')>500
    or jsonb_array_length(snapshot->'operations_operating_agreements')>100
    or octet_length(snapshot::text)>8388608 then
    raise exception using errcode='54000',message='Evidence snapshot exceeds safe bound; shorten window or review facility scope';
  end if;
  return snapshot;
end $$;
revoke all on function public.operations_workspace_snapshot(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.operations_workspace_snapshot(uuid,timestamptz,timestamptz) to authenticated;
