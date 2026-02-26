create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  owner_user_id uuid,
  description text,
  dna_profile jsonb,
  brain_profile jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table companies add column if not exists name text;
alter table companies add column if not exists slug text;
alter table companies add column if not exists owner_user_id uuid;
alter table companies add column if not exists description text;
alter table companies add column if not exists dna_profile jsonb;
alter table companies add column if not exists brain_profile jsonb;
alter table companies add column if not exists created_at timestamptz;
alter table companies add column if not exists updated_at timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'companies' and column_name = 'created_by'
  ) then
    execute 'update public.companies set owner_user_id = created_by where owner_user_id is null';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'companies' and column_name = 'user_id'
  ) then
    execute 'update public.companies set owner_user_id = user_id where owner_user_id is null';
  end if;
end $$;

create table if not exists company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null default 'rep',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create unique index if not exists idx_company_members_unique
  on company_members(company_id, user_id);

create index if not exists idx_company_members_user
  on company_members(user_id);

create table if not exists company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  email text not null,
  role text not null default 'rep',
  invited_by uuid references auth.users(id),
  token text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_company_invites_token
  on company_invites(token);

create index if not exists idx_company_invites_company
  on company_invites(company_id);

insert into company_members (company_id, user_id, role, status)
select id, owner_user_id, 'owner', 'active'
from companies
where owner_user_id is not null
on conflict (company_id, user_id) do nothing;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'company_assignments'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'team_members' and column_name = 'user_id'
  ) then
    execute '
      insert into company_members (company_id, user_id, role, status)
      select ca.company_id, tm.user_id, ''rep'', ''active''
      from company_assignments ca
      join team_members tm on tm.id = ca.member_id
      where tm.user_id is not null
      on conflict (company_id, user_id) do nothing
    ';
  end if;
end $$;

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

create or replace function public.is_company_manager(company uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from company_members cm
    where cm.company_id = company
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin', 'manager')
  );
$$;

alter table companies enable row level security;
alter table company_members enable row level security;
alter table company_invites enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'companies' and policyname = 'companies_select_member'
  ) then
    create policy "companies_select_member"
      on public.companies
      for select
      using (is_company_member(id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'companies' and policyname = 'companies_insert_owner'
  ) then
    create policy "companies_insert_owner"
      on public.companies
      for insert
      with check (owner_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'companies' and policyname = 'companies_update_admin'
  ) then
    create policy "companies_update_admin"
      on public.companies
      for update
      using (is_company_admin(id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'companies' and policyname = 'companies_delete_owner'
  ) then
    create policy "companies_delete_owner"
      on public.companies
      for delete
      using (is_company_admin(id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_members' and policyname = 'company_members_select_own'
  ) then
    create policy "company_members_select_own"
      on public.company_members
      for select
      using (user_id = auth.uid() or is_company_admin(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_members' and policyname = 'company_members_insert_admin'
  ) then
    create policy "company_members_insert_admin"
      on public.company_members
      for insert
      with check (is_company_admin(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_members' and policyname = 'company_members_update_admin'
  ) then
    create policy "company_members_update_admin"
      on public.company_members
      for update
      using (is_company_admin(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_members' and policyname = 'company_members_delete_admin'
  ) then
    create policy "company_members_delete_admin"
      on public.company_members
      for delete
      using (is_company_admin(company_id) or user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_invites' and policyname = 'company_invites_select_admin'
  ) then
    create policy "company_invites_select_admin"
      on public.company_invites
      for select
      using (is_company_admin(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_invites' and policyname = 'company_invites_insert_admin'
  ) then
    create policy "company_invites_insert_admin"
      on public.company_invites
      for insert
      with check (is_company_admin(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_invites' and policyname = 'company_invites_update_admin'
  ) then
    create policy "company_invites_update_admin"
      on public.company_invites
      for update
      using (is_company_admin(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_invites' and policyname = 'company_invites_delete_admin'
  ) then
    create policy "company_invites_delete_admin"
      on public.company_invites
      for delete
      using (is_company_admin(company_id));
  end if;
end $$;

create table if not exists company_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  created_by uuid references auth.users(id),
  dna_profile jsonb,
  brain_profile jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_company_profiles_company
  on company_profiles(company_id);

alter table company_profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_profiles' and policyname = 'company_profiles_select_member'
  ) then
    create policy "company_profiles_select_member"
      on public.company_profiles
      for select
      using (is_company_member(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_profiles' and policyname = 'company_profiles_insert_admin'
  ) then
    create policy "company_profiles_insert_admin"
      on public.company_profiles
      for insert
      with check (is_company_admin(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_profiles' and policyname = 'company_profiles_update_admin'
  ) then
    create policy "company_profiles_update_admin"
      on public.company_profiles
      for update
      using (is_company_admin(company_id));
  end if;
end $$;

create table if not exists company_financial_statements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  statement_type text not null,
  period_start date,
  period_end date,
  currency text not null default 'USD',
  data jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_company_financial_statements_company
  on company_financial_statements(company_id, period_end desc);

alter table company_financial_statements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_financial_statements' and policyname = 'company_financial_statements_select'
  ) then
    create policy "company_financial_statements_select"
      on public.company_financial_statements
      for select
      using (is_company_member(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_financial_statements' and policyname = 'company_financial_statements_write'
  ) then
    create policy "company_financial_statements_write"
      on public.company_financial_statements
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

create table if not exists company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  title text,
  doc_type text,
  file_path text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_company_documents_company
  on company_documents(company_id, created_at desc);

alter table company_documents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_documents' and policyname = 'company_documents_select'
  ) then
    create policy "company_documents_select"
      on public.company_documents
      for select
      using (is_company_member(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_documents' and policyname = 'company_documents_write'
  ) then
    create policy "company_documents_write"
      on public.company_documents
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

create table if not exists org_positions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  department text,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_org_positions_company
  on org_positions(company_id);

create table if not exists org_position_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  position_id uuid not null references org_positions(id) on delete cascade,
  user_id uuid references auth.users(id),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_position_assignments_company
  on org_position_assignments(company_id);

create table if not exists org_position_managers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  position_id uuid not null references org_positions(id) on delete cascade,
  manager_position_id uuid not null references org_positions(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_position_managers_company
  on org_position_managers(company_id);

alter table org_positions enable row level security;
alter table org_position_assignments enable row level security;
alter table org_position_managers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'org_positions' and policyname = 'org_positions_select'
  ) then
    create policy "org_positions_select"
      on public.org_positions
      for select
      using (is_company_member(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'org_positions' and policyname = 'org_positions_write'
  ) then
    create policy "org_positions_write"
      on public.org_positions
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'org_position_assignments' and policyname = 'org_position_assignments_select'
  ) then
    create policy "org_position_assignments_select"
      on public.org_position_assignments
      for select
      using (is_company_member(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'org_position_assignments' and policyname = 'org_position_assignments_write'
  ) then
    create policy "org_position_assignments_write"
      on public.org_position_assignments
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'org_position_managers' and policyname = 'org_position_managers_select'
  ) then
    create policy "org_position_managers_select"
      on public.org_position_managers
      for select
      using (is_company_member(company_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'org_position_managers' and policyname = 'org_position_managers_write'
  ) then
    create policy "org_position_managers_write"
      on public.org_position_managers
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

create table if not exists level10_meeting_series (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  cadence text not null default 'weekly',
  timezone text not null default 'UTC',
  owner_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_level10_meeting_series_company
  on level10_meeting_series(company_id);

create table if not exists level10_meeting_instances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  series_id uuid not null references level10_meeting_series(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled',
  created_by uuid references auth.users(id),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_level10_meeting_instances_company
  on level10_meeting_instances(company_id, scheduled_for desc);

create table if not exists level10_meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  meeting_id uuid not null references level10_meeting_instances(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null default 'attendee',
  created_at timestamptz not null default now()
);

create index if not exists idx_level10_meeting_attendees_company
  on level10_meeting_attendees(company_id);

create table if not exists level10_scorecard_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  target_value numeric,
  unit text,
  owner_user_id uuid references auth.users(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_level10_scorecard_metrics_company
  on level10_scorecard_metrics(company_id);

create table if not exists level10_scorecard_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  meeting_id uuid not null references level10_meeting_instances(id) on delete cascade,
  metric_id uuid not null references level10_scorecard_metrics(id) on delete cascade,
  value numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_level10_scorecard_entries_company
  on level10_scorecard_entries(company_id, created_at desc);

create table if not exists level10_rocks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  owner_user_id uuid references auth.users(id),
  title text not null,
  quarter text,
  due_date date,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_level10_rocks_company
  on level10_rocks(company_id);

create table if not exists level10_issues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  meeting_id uuid not null references level10_meeting_instances(id) on delete cascade,
  owner_user_id uuid references auth.users(id),
  title text not null,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_level10_issues_company
  on level10_issues(company_id, created_at desc);

create table if not exists level10_todos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  meeting_id uuid not null references level10_meeting_instances(id) on delete cascade,
  assignee_user_id uuid references auth.users(id),
  title text not null,
  due_date date,
  status text not null default 'open',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_level10_todos_company
  on level10_todos(company_id, created_at desc);

create table if not exists level10_recap (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  meeting_id uuid not null references level10_meeting_instances(id) on delete cascade,
  summary text,
  decisions text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table level10_meeting_series enable row level security;
alter table level10_meeting_instances enable row level security;
alter table level10_meeting_attendees enable row level security;
alter table level10_scorecard_metrics enable row level security;
alter table level10_scorecard_entries enable row level security;
alter table level10_rocks enable row level security;
alter table level10_issues enable row level security;
alter table level10_todos enable row level security;
alter table level10_recap enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_meeting_series' and policyname = 'level10_meeting_series_select'
  ) then
    create policy "level10_meeting_series_select"
      on public.level10_meeting_series
      for select
      using (is_company_member(company_id));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_meeting_series' and policyname = 'level10_meeting_series_write'
  ) then
    create policy "level10_meeting_series_write"
      on public.level10_meeting_series
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_meeting_instances' and policyname = 'level10_meeting_instances_select'
  ) then
    create policy "level10_meeting_instances_select"
      on public.level10_meeting_instances
      for select
      using (is_company_member(company_id));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_meeting_instances' and policyname = 'level10_meeting_instances_write'
  ) then
    create policy "level10_meeting_instances_write"
      on public.level10_meeting_instances
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_meeting_attendees' and policyname = 'level10_meeting_attendees_select'
  ) then
    create policy "level10_meeting_attendees_select"
      on public.level10_meeting_attendees
      for select
      using (is_company_member(company_id));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_meeting_attendees' and policyname = 'level10_meeting_attendees_write'
  ) then
    create policy "level10_meeting_attendees_write"
      on public.level10_meeting_attendees
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_scorecard_metrics' and policyname = 'level10_scorecard_metrics_select'
  ) then
    create policy "level10_scorecard_metrics_select"
      on public.level10_scorecard_metrics
      for select
      using (is_company_member(company_id));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_scorecard_metrics' and policyname = 'level10_scorecard_metrics_write'
  ) then
    create policy "level10_scorecard_metrics_write"
      on public.level10_scorecard_metrics
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_scorecard_entries' and policyname = 'level10_scorecard_entries_select'
  ) then
    create policy "level10_scorecard_entries_select"
      on public.level10_scorecard_entries
      for select
      using (is_company_member(company_id));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_scorecard_entries' and policyname = 'level10_scorecard_entries_write'
  ) then
    create policy "level10_scorecard_entries_write"
      on public.level10_scorecard_entries
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_rocks' and policyname = 'level10_rocks_select'
  ) then
    create policy "level10_rocks_select"
      on public.level10_rocks
      for select
      using (is_company_member(company_id));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_rocks' and policyname = 'level10_rocks_write'
  ) then
    create policy "level10_rocks_write"
      on public.level10_rocks
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_issues' and policyname = 'level10_issues_select'
  ) then
    create policy "level10_issues_select"
      on public.level10_issues
      for select
      using (is_company_member(company_id));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_issues' and policyname = 'level10_issues_write'
  ) then
    create policy "level10_issues_write"
      on public.level10_issues
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_todos' and policyname = 'level10_todos_select'
  ) then
    create policy "level10_todos_select"
      on public.level10_todos
      for select
      using (is_company_member(company_id));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_todos' and policyname = 'level10_todos_write'
  ) then
    create policy "level10_todos_write"
      on public.level10_todos
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_recap' and policyname = 'level10_recap_select'
  ) then
    create policy "level10_recap_select"
      on public.level10_recap
      for select
      using (is_company_member(company_id));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'level10_recap' and policyname = 'level10_recap_write'
  ) then
    create policy "level10_recap_write"
      on public.level10_recap
      for all
      using (is_company_manager(company_id))
      with check (is_company_manager(company_id));
  end if;
end $$;
