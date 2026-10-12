-- Extend canonical runs instead of creating a second assessment store.
alter table public.operations_calculation_runs add column input_snapshot jsonb;
alter table public.operations_dispatch_approvals add column recommendation_input_fingerprint text;
update public.operations_dispatch_approvals a set recommendation_input_fingerprint=r.input_fingerprint
from public.operations_recommendations r where r.id=a.recommendation_id;
alter table public.operations_dispatch_approvals alter column recommendation_input_fingerprint set not null;
alter table public.operations_dispatch_approvals drop constraint operations_dispatch_approvals_recommendation_id_approver_id_key;
drop policy "owners manage dispatch approvals" on public.operations_dispatch_approvals;
create policy "owners read dispatch reviews" on public.operations_dispatch_approvals for select to authenticated using(owner_id=auth.uid());
create policy "owners append dispatch reviews" on public.operations_dispatch_approvals for insert to authenticated
  with check(owner_id=auth.uid() and approver_id=auth.uid());
revoke update,delete on public.operations_dispatch_approvals from authenticated;

create function public.operations_guard_review() returns trigger language plpgsql set search_path=public as $$
declare r public.operations_recommendations;
begin
  select * into r from public.operations_recommendations where id=new.recommendation_id;
  if r.id is null or r.owner_id<>new.owner_id or r.facility_id<>new.facility_id then
    raise exception using errcode='42501',message='Review belongs to another facility or owner'; end if;
  if new.decision='approved' and (not r.feasible or r.expires_at<=now() or r.state in ('expired','rejected')) then
    raise exception using errcode='22023',message='Recommendation is not currently reviewable'; end if;
  new.recommendation_input_fingerprint:=r.input_fingerprint;
  new.decision_at:=now();
  return new;
end $$;
create trigger operations_dispatch_review_guard before insert on public.operations_dispatch_approvals
  for each row execute function public.operations_guard_review();

create function public.operations_guard_recommendation_version() returns trigger language plpgsql set search_path=public as $$
begin
  if (to_jsonb(new)-'state') is distinct from (to_jsonb(old)-'state') then
    raise exception using errcode='22023',message='Create a new recommendation version instead of modifying assessed inputs'; end if;
  return new;
end $$;
create trigger operations_recommendation_version_guard before update on public.operations_recommendations
  for each row execute function public.operations_guard_recommendation_version();

create function public.operations_guard_facility_owner() returns trigger language plpgsql security definer set search_path=public as $$
declare row_data jsonb:=to_jsonb(new);
begin
  if not exists(select 1 from public.operations_facilities f where f.id=new.facility_id and f.owner_id=new.owner_id) then
    raise exception using errcode='42501',message='Operations facility owner mismatch'; end if;
  if row_data->>'source_id' is not null and not exists(select 1 from public.operations_sources s
      where s.id=(row_data->>'source_id')::uuid and s.facility_id=new.facility_id and s.owner_id=new.owner_id) then
    raise exception using errcode='42501',message='Operations source linkage mismatch'; end if;
  if row_data->>'forecast_id' is not null and not exists(select 1 from public.operations_forecasts f
      where f.id=(row_data->>'forecast_id')::uuid and f.facility_id=new.facility_id and f.owner_id=new.owner_id) then
    raise exception using errcode='42501',message='Operations forecast linkage mismatch'; end if;
  if row_data->>'recommendation_id' is not null and not exists(select 1 from public.operations_recommendations r
      where r.id=(row_data->>'recommendation_id')::uuid and r.facility_id=new.facility_id and r.owner_id=new.owner_id) then
    raise exception using errcode='42501',message='Operations recommendation linkage mismatch'; end if;
  if row_data->>'agreement_id' is not null and not exists(select 1 from public.operations_operating_agreements a
      where a.id=(row_data->>'agreement_id')::uuid and a.facility_id=new.facility_id and a.owner_id=new.owner_id) then
    raise exception using errcode='42501',message='Operations agreement linkage mismatch'; end if;
  return new;
end $$;
create function public.operations_guard_calculation_version() returns trigger language plpgsql set search_path=public as $$
begin raise exception using errcode='22023',message='Calculation snapshots are immutable; create a new version'; end $$;
create trigger operations_calculation_version_guard before update on public.operations_calculation_runs
  for each row execute function public.operations_guard_calculation_version();
do $$ declare target text; begin
  foreach target in array array['operations_sources','operations_battery_assets','operations_forecasts',
    'operations_recommendations','operations_verifications','operations_connector_configs',
    'operations_operating_agreements','operations_calculation_runs','operations_dispatch_approvals'] loop
    execute format('create trigger operations_facility_owner_guard before insert or update on public.%I for each row execute function public.operations_guard_facility_owner()',target);
  end loop;
end $$;

create function public.operations_record_calculation(p_owner_id uuid,p_facility_id uuid,p_input_snapshot jsonb,
  p_result jsonb,p_fingerprint text,p_calculation_version text,p_mode text)
returns uuid language plpgsql security definer set search_path=public as $$
declare run_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='Trusted assessment service required'; end if;
  if p_mode not in ('scenario','historical') or p_result->>'automaticDispatchAuthorized' is distinct from 'false' then
    raise exception using errcode='22023',message='Only read-only assessments may be recorded'; end if;
  insert into public.operations_calculation_runs(owner_id,facility_id,mode,calculation_version,
    evidence_cutoff,input_fingerprint,input_snapshot,result)
  values(p_owner_id,p_facility_id,p_mode,p_calculation_version,now(),p_fingerprint,p_input_snapshot,p_result)
  returning id into run_id;
  return run_id;
end $$;
revoke all on function public.operations_record_calculation(uuid,uuid,jsonb,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.operations_record_calculation(uuid,uuid,jsonb,jsonb,text,text,text) to service_role;
