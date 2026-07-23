-- Explicit, service-role-only rollback for validated dataset releases.

create or replace function public.rollback_grid_dataset_release(
  p_current_release_id uuid,
  p_target_release_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_release public.grid_dataset_releases;
  target_release public.grid_dataset_releases;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'rollback reason is required';
  end if;

  select * into current_release
  from public.grid_dataset_releases where id = p_current_release_id for update;
  select * into target_release
  from public.grid_dataset_releases where id = p_target_release_id for update;

  if current_release.status <> 'active' then
    raise exception 'current release is not active';
  end if;
  if target_release.status <> 'superseded' then
    raise exception 'target release is not superseded';
  end if;
  if current_release.source_id <> target_release.source_id then
    raise exception 'releases belong to different sources';
  end if;
  if coalesce((target_release.validation_report ->> 'valid')::boolean, false) is not true then
    raise exception 'target release is not validated';
  end if;

  update public.grid_dataset_releases
  set status = 'rolled_back',
      superseded_at = now(),
      validation_report = validation_report || jsonb_build_object(
        'rolled_back_at', now(),
        'rollback_reason', p_reason
      )
  where id = current_release.id;

  update public.grid_dataset_releases
  set status = 'active',
      activated_at = now(),
      superseded_at = null,
      validation_report = validation_report || jsonb_build_object(
        'reactivated_at', now(),
        'reactivation_reason', p_reason
      )
  where id = target_release.id;
end;
$$;

revoke all on function public.rollback_grid_dataset_release(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.rollback_grid_dataset_release(uuid, uuid, text)
  to service_role;
