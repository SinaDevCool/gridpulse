-- Schema-v6 enrichment contract: explicit source coverage, deterministic observations,
-- and valid negative findings only where an accepted release confirms coverage.

alter function public.property_enrichment_batch(jsonb, text[])
  rename to property_enrichment_batch_v5;

create or replace function public.property_enrichment_batch(
  p_properties jsonb,
  p_sources text[] default array['bkg_admin','osm_context','bfn_protected','mastr','bkg_heavy_rain','power_finder']::text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '18s'
as $$
declare
  base jsonb;
  additions jsonb;
  statuses jsonb;
  fingerprint text;
begin
  base := public.property_enrichment_batch_v5(p_properties, p_sources);

  with requested as (
    select value->>'property_id' property_id,
      extensions.st_setsrid(extensions.st_makepoint(
        (value->>'longitude')::double precision,
        (value->>'latitude')::double precision
      ), 4326) point,
      case when value->'boundary' is null or value->'boundary' = 'null'::jsonb
        then null
        else extensions.st_setsrid(extensions.st_geomfromgeojson((value->'boundary')::text),4326)
      end boundary
    from jsonb_array_elements(p_properties) value
  ), requested_sources as (
    select unnest(p_sources) source
  ), source_map as (
    select rs.source, s.id source_id
    from requested_sources rs
    left join public.grid_sources s on
      (rs.source='bkg_admin' and (s.id ilike '%bkg%' or s.dataset_domain='administrative')) or
      (rs.source='osm_context' and (s.id ilike '%osm%' or s.dataset_domain='built_environment')) or
      (rs.source='bfn_protected' and (s.id ilike '%bfn%' or s.dataset_domain='environment')) or
      (rs.source='mastr' and s.id ilike '%mastr%') or
      (rs.source='bkg_heavy_rain' and (s.id ilike '%rain%' or s.dataset_domain='natural_hazard')) or
      (rs.source='power_finder' and s.dataset_domain='grid')
  ), active as (
    select r.id, r.source_id, r.activated_at
    from public.grid_dataset_releases r where r.status='active'
  ), property_source as (
    select q.property_id, q.point, q.boundary, rs.source,
      case
        when exists (
          select 1 from source_map sm join public.enrichment_coverage c on c.source_id=sm.source_id
          where sm.source=rs.source and c.status='available'
            and (c.geometry is null or extensions.st_covers(c.geometry,q.point))
        ) then 'complete'
        when exists (
          select 1 from source_map sm join public.enrichment_coverage c on c.source_id=sm.source_id
          where sm.source=rs.source
        ) then 'not_covered'
        when rs.source in ('bkg_admin','osm_context','mastr','power_finder') and exists (
          select 1 from source_map sm join active a on a.source_id=sm.source_id where sm.source=rs.source
        ) then 'complete'
        else 'unavailable'
      end status,
      (select a.id::text from source_map sm join active a on a.source_id=sm.source_id
       where sm.source=rs.source order by a.activated_at desc nulls last limit 1) release_id
    from requested q cross join requested_sources rs
  ), negative_findings as (
    select jsonb_build_object(
      'id',gen_random_uuid(),'propertyId',ps.property_id,'source','bfn_protected',
      'category','environment','fieldPath',null,'title','No mapped protected-area intersection',
      'displayValue','No intersection in the accepted covered BfN release','proposedValue',false,
      'status','proposed','confidence','high','method','intersection','sourceOrganisation','Bundesamt fÃ¼r Naturschutz',
      'sourceReference','covered-non-intersection','sourceUrl','https://www.bfn.de/',
      'licence','Data licence stated by source','releaseId',coalesce(ps.release_id,'accepted-release'),
      'observedAt',null,'retrievedAt',now(),'coverage','available',
      'limitations',jsonb_build_array('Public screening only; environmental and planning confirmation remains required.'),
      'reviewedAt',null,
      'findingKey',encode(extensions.digest(ps.property_id||':bfn_protected:non_intersection:'||coalesce(ps.release_id,'none'),'sha256'),'hex'),
      'polarity','positive','screeningEffect','supports','distanceMetres',null,
      'geometryRelation','none','supersedesFindingId',null,'automaticallyDerived',true
    ) finding
    from property_source ps
    where ps.source='bfn_protected' and ps.status='complete'
      and not exists (
        select 1 from public.protected_areas p
        where extensions.st_intersects(p.geometry,coalesce(ps.boundary,ps.point))
      )
    union all
    select jsonb_build_object(
      'id',gen_random_uuid(),'propertyId',ps.property_id,'source','bkg_heavy_rain',
      'category','environment','fieldPath',null,'title','No mapped heavy-rain intersection',
      'displayValue','No intersection in the accepted covered heavy-rain release','proposedValue',false,
      'status','proposed','confidence','high','method','intersection','sourceOrganisation','Bundesamt fÃ¼r Kartographie und GeodÃ¤sie',
      'sourceReference','covered-non-intersection','sourceUrl','https://www.bkg.bund.de/',
      'licence','Data Licence Germany â€“ attribution â€“ version 2.0','releaseId',coalesce(ps.release_id,'accepted-release'),
      'observedAt',null,'retrievedAt',now(),'coverage','available',
      'limitations',jsonb_build_array('Coverage-specific public screening; not a site-specific flood assessment.'),
      'reviewedAt',null,
      'findingKey',encode(extensions.digest(ps.property_id||':bkg_heavy_rain:non_intersection:'||coalesce(ps.release_id,'none'),'sha256'),'hex'),
      'polarity','positive','screeningEffect','supports','distanceMetres',null,
      'geometryRelation','none','supersedesFindingId',null,'automaticallyDerived',true
    ) finding
    from property_source ps
    where ps.source='bkg_heavy_rain' and ps.status='complete'
      and not exists (
        select 1 from public.heavy_rain_areas h
        where extensions.st_intersects(h.geometry,coalesce(ps.boundary,ps.point))
      )
  ), context_findings as (
    select jsonb_build_object(
      'id',gen_random_uuid(),'propertyId',ps.property_id,'source','osm_context',
      'category',case when nearest.feature_class in ('road','rail') then 'access_logistics' else 'land' end,
      'fieldPath',case when nearest.feature_class='address' then 'dataCentreProfile.address' else null end,
      'title',case nearest.feature_class
        when 'address' then 'Nearest mapped address context'
        when 'building' then 'Nearest mapped building context'
        when 'road' then 'Nearest mapped road access'
        when 'rail' then 'Nearest mapped rail context' end,
      'displayValue',coalesce(nearest.name,nearest.metadata->>'addr:full',nearest.feature_class)||' · '||round(nearest.distance_m)::text||' m',
      'proposedValue',coalesce(nearest.name,nearest.metadata->>'addr:full',nearest.feature_class),
      'status','proposed','confidence','medium','method','nearest','sourceOrganisation',src.publisher,
      'sourceReference',nearest.source_record_id,'sourceUrl',src.source_url,'licence',src.licence,
      'releaseId',nearest.dataset_release_id::text,'observedAt',ar.activated_at,'retrievedAt',now(),
      'coverage','available','limitations',jsonb_build_array('Open mapping is screening context and requires site verification.'),
      'reviewedAt',null,
      'findingKey',encode(extensions.digest(ps.property_id||':osm_context:'||nearest.feature_class||':'||nearest.source_record_id||':'||nearest.dataset_release_id::text,'sha256'),'hex'),
      'polarity','neutral','screeningEffect','context','distanceMetres',round(nearest.distance_m),
      'geometryRelation','nearest','supersedesFindingId',null,'automaticallyDerived',true
    ) finding
    from property_source ps
    cross join lateral (
      select distinct on (f.feature_class) f.*,
        extensions.st_distance(f.geometry::geography,ps.point::geography) distance_m
      from public.osm_context_features f
      where f.feature_class in ('address','building','road','rail')
        and extensions.st_dwithin(f.geometry::geography,ps.point::geography,1000)
      order by f.feature_class, f.geometry <-> ps.point
    ) nearest
    join public.grid_dataset_releases ar on ar.id=nearest.dataset_release_id and ar.status='active'
    join public.grid_sources src on src.id=ar.source_id
    where ps.source='osm_context' and ps.status='complete'
  ), all_new_findings as (
    select finding from negative_findings
    union all
    select finding from context_findings
  ), source_results as (
    select jsonb_agg(jsonb_build_object(
      'propertyId',ps.property_id,'source',ps.source,'status',ps.status,
      'findingCount',(
        select count(*) from jsonb_array_elements(
          coalesce(base->'findings','[]'::jsonb) ||
          coalesce((select jsonb_agg(finding) from all_new_findings),'[]'::jsonb)
        ) f where f->>'propertyId'=ps.property_id and f->>'source'=ps.source
      ),
      'releaseId',ps.release_id,'checkedAt',now(),
      'limitation',case
        when ps.status='not_covered' then 'The property is outside the accepted dataset coverage.'
        when ps.status='unavailable' then 'No accepted usable release was available.'
        else null end
    ) order by ps.property_id,ps.source) value
    from property_source ps
  )
  select
    coalesce((select jsonb_agg(finding) from all_new_findings),'[]'::jsonb),
    coalesce((select value from source_results),'[]'::jsonb),
    encode(extensions.digest(
      coalesce(string_agg(distinct release_id,',' order by release_id),'none'),
      'sha256'
    ),'hex')
  into additions,statuses,fingerprint
  from property_source;

  return jsonb_build_object(
    'releaseFingerprint',fingerprint,
    'findings',coalesce(base->'findings','[]'::jsonb) || additions,
    'sourceStatus',coalesce(base->'sourceStatus','{}'::jsonb),
    'sourceResults',statuses
  );
end;
$$;

revoke all on function public.property_enrichment_batch(jsonb,text[]) from public, authenticated;
grant execute on function public.property_enrichment_batch(jsonb,text[]) to anon;

comment on function public.property_enrichment_batch is
  'Bounded schema-v6 property enrichment with explicit coverage semantics and deterministic review keys.';
