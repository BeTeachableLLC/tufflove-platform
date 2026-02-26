create table if not exists user_dna_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dna_profile jsonb,
  dna_text text,
  brain_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_dna_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  file_name text,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_dna_documents_user
  on user_dna_documents(user_id, created_at desc);

alter table user_dna_profiles enable row level security;
alter table user_dna_documents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_dna_profiles'
      and policyname = 'user_dna_profiles_select_own'
  ) then
    create policy "user_dna_profiles_select_own"
      on public.user_dna_profiles
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_dna_profiles'
      and policyname = 'user_dna_profiles_insert_own'
  ) then
    create policy "user_dna_profiles_insert_own"
      on public.user_dna_profiles
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_dna_profiles'
      and policyname = 'user_dna_profiles_update_own'
  ) then
    create policy "user_dna_profiles_update_own"
      on public.user_dna_profiles
      for update
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_dna_documents'
      and policyname = 'user_dna_documents_select_own'
  ) then
    create policy "user_dna_documents_select_own"
      on public.user_dna_documents
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_dna_documents'
      and policyname = 'user_dna_documents_insert_own'
  ) then
    create policy "user_dna_documents_insert_own"
      on public.user_dna_documents
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_dna_documents'
      and policyname = 'user_dna_documents_delete_own'
  ) then
    create policy "user_dna_documents_delete_own"
      on public.user_dna_documents
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
