create table if not exists training_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  company_id uuid references companies(id) on delete cascade,
  title text not null,
  description text,
  category text,
  content_body text,
  video_url text,
  source_type text,
  source_key text,
  auto_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table training_modules add column if not exists user_id uuid;
alter table training_modules add column if not exists company_id uuid;
alter table training_modules add column if not exists title text;
alter table training_modules add column if not exists description text;
alter table training_modules add column if not exists category text;
alter table training_modules add column if not exists content_body text;
alter table training_modules add column if not exists video_url text;
alter table training_modules add column if not exists source_type text;
alter table training_modules add column if not exists source_key text;
alter table training_modules add column if not exists auto_published boolean;
alter table training_modules add column if not exists created_at timestamptz;
alter table training_modules add column if not exists updated_at timestamptz;

create index if not exists idx_training_modules_user
  on training_modules(user_id, created_at desc);

create index if not exists idx_training_modules_company
  on training_modules(company_id, created_at desc);

create unique index if not exists idx_training_modules_source_key
  on training_modules(source_key);

alter table training_modules enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'training_modules' and policyname = 'training_modules_select'
  ) then
    create policy "training_modules_select"
      on public.training_modules
      for select
      using (
        (user_id = auth.uid())
        or (company_id is not null and is_company_member(company_id))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'training_modules' and policyname = 'training_modules_insert'
  ) then
    create policy "training_modules_insert"
      on public.training_modules
      for insert
      with check (
        (user_id = auth.uid() and company_id is null)
        or (company_id is not null and is_company_manager(company_id))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'training_modules' and policyname = 'training_modules_update'
  ) then
    create policy "training_modules_update"
      on public.training_modules
      for update
      using (
        (user_id = auth.uid())
        or (company_id is not null and is_company_manager(company_id))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'training_modules' and policyname = 'training_modules_delete'
  ) then
    create policy "training_modules_delete"
      on public.training_modules
      for delete
      using (
        (user_id = auth.uid())
        or (company_id is not null and is_company_manager(company_id))
      );
  end if;
end $$;
