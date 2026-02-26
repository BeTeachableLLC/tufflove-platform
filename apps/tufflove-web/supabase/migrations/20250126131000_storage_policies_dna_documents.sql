insert into storage.buckets (id, name, public)
values ('company-documents', 'company-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('user-dna', 'user-dna', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'company_documents_read_member'
  ) then
    create policy "company_documents_read_member"
      on storage.objects
      for select
      using (
        bucket_id = 'company-documents'
        and case
          when name ~ '^[0-9a-fA-F-]{36}/' then is_company_member(split_part(name, '/', 1)::uuid)
          else false
        end
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'company_documents_insert_manager'
  ) then
    create policy "company_documents_insert_manager"
      on storage.objects
      for insert
      with check (
        bucket_id = 'company-documents'
        and auth.uid() = owner
        and case
          when name ~ '^[0-9a-fA-F-]{36}/' then is_company_manager(split_part(name, '/', 1)::uuid)
          else false
        end
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'company_documents_delete_manager'
  ) then
    create policy "company_documents_delete_manager"
      on storage.objects
      for delete
      using (
        bucket_id = 'company-documents'
        and case
          when name ~ '^[0-9a-fA-F-]{36}/' then is_company_manager(split_part(name, '/', 1)::uuid)
          else false
        end
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_dna_read_own'
  ) then
    create policy "user_dna_read_own"
      on storage.objects
      for select
      using (bucket_id = 'user-dna' and auth.uid() = owner);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_dna_insert_own'
  ) then
    create policy "user_dna_insert_own"
      on storage.objects
      for insert
      with check (bucket_id = 'user-dna' and auth.uid() = owner);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_dna_delete_own'
  ) then
    create policy "user_dna_delete_own"
      on storage.objects
      for delete
      using (bucket_id = 'user-dna' and auth.uid() = owner);
  end if;
end $$;
