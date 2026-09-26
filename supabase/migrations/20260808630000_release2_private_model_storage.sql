-- Forward-only Release 2 private artifact storage configuration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'grid-surrogate-models',
  'grid-surrogate-models',
  false,
  52428800,
  array['application/octet-stream']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
