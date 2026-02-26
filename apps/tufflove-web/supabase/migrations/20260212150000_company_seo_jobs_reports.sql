create or replace function public.is_company_member(company uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from company_members cm
    where cm.company_id = company and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_company_admin(company uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from company_members cm
    where cm.company_id = company
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin')
  );
$$;

create table if not exists company_seo_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  website text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  score numeric,
  summary text,
  recommendations jsonb,
  issues jsonb,
  data jsonb
);

create table if not exists company_seo_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  website text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  requested_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  report_id uuid references company_seo_reports(id)
);

create index if not exists idx_company_seo_reports_company
  on company_seo_reports(company_id);

create index if not exists idx_company_seo_jobs_company
  on company_seo_jobs(company_id);

create index if not exists idx_company_seo_jobs_requested_at
  on company_seo_jobs(requested_at);

alter table company_seo_reports enable row level security;
alter table company_seo_jobs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_seo_reports' and policyname = 'company_seo_reports_select_member'
  ) then
    create policy "company_seo_reports_select_member"
      on public.company_seo_reports
      for select
      using (is_company_member(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_seo_reports' and policyname = 'company_seo_reports_insert_admin'
  ) then
    create policy "company_seo_reports_insert_admin"
      on public.company_seo_reports
      for insert
      with check (is_company_admin(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_seo_jobs' and policyname = 'company_seo_jobs_select_member'
  ) then
    create policy "company_seo_jobs_select_member"
      on public.company_seo_jobs
      for select
      using (is_company_member(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_seo_jobs' and policyname = 'company_seo_jobs_insert_member'
  ) then
    create policy "company_seo_jobs_insert_member"
      on public.company_seo_jobs
      for insert
      with check (requested_by = auth.uid() and is_company_member(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_seo_jobs' and policyname = 'company_seo_jobs_update_admin'
  ) then
    create policy "company_seo_jobs_update_admin"
      on public.company_seo_jobs
      for update
      using (is_company_admin(company_id));
  end if;
end $$;
