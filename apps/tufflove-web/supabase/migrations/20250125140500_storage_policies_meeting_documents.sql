insert into storage.buckets (id, name, public)
values ('meeting-documents', 'meeting-documents', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'meeting_documents_read_own'
  ) then
    create policy "meeting_documents_read_own"
      on storage.objects
      for select
      using (bucket_id = 'meeting-documents' and auth.uid() = owner);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'meeting_documents_insert_own'
  ) then
    create policy "meeting_documents_insert_own"
      on storage.objects
      for insert
      with check (bucket_id = 'meeting-documents' and auth.uid() = owner);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'meeting_documents_delete_own'
  ) then
    create policy "meeting_documents_delete_own"
      on storage.objects
      for delete
      using (bucket_id = 'meeting-documents' and auth.uid() = owner);
  end if;
end $$;
