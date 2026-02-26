create table if not exists assessment_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  company_id uuid references companies(id) on delete cascade,
  assessment_type text not null,
  responses jsonb,
  results jsonb,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_assessment_runs_user
  on assessment_runs(user_id, assessment_type, completed_at desc);

create index if not exists idx_assessment_runs_company
  on assessment_runs(company_id, assessment_type, completed_at desc);

alter table assessment_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'assessment_runs' and policyname = 'assessment_runs_select'
  ) then
    create policy "assessment_runs_select"
      on public.assessment_runs
      for select
      using (
        user_id = auth.uid()
        or (company_id is not null and is_company_member(company_id))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'assessment_runs' and policyname = 'assessment_runs_insert'
  ) then
    create policy "assessment_runs_insert"
      on public.assessment_runs
      for insert
      with check (
        user_id = auth.uid()
        and (company_id is null or is_company_member(company_id))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'assessment_runs' and policyname = 'assessment_runs_delete'
  ) then
    create policy "assessment_runs_delete"
      on public.assessment_runs
      for delete
      using (
        user_id = auth.uid()
        or (company_id is not null and is_company_admin(company_id))
      );
  end if;
end $$;
