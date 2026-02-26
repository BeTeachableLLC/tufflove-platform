create table if not exists lead_verifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  provider text not null,
  status text not null,
  confidence integer,
  matched_fields text[],
  evidence jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_verifications_lead_id
  on lead_verifications(lead_id, created_at desc);

alter table lead_verifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_verifications'
      and policyname = 'lead_verifications_select_own'
  ) then
    create policy "lead_verifications_select_own"
      on public.lead_verifications
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_verifications'
      and policyname = 'lead_verifications_insert_own'
  ) then
    create policy "lead_verifications_insert_own"
      on public.lead_verifications
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_verifications'
      and policyname = 'lead_verifications_delete_own'
  ) then
    create policy "lead_verifications_delete_own"
      on public.lead_verifications
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
