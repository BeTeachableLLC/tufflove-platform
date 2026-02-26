create table if not exists lead_note_entries (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_note_entries_lead_id
  on lead_note_entries(lead_id, created_at desc);

alter table lead_note_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_note_entries'
      and policyname = 'lead_note_entries_select_own'
  ) then
    create policy "lead_note_entries_select_own"
      on public.lead_note_entries
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_note_entries'
      and policyname = 'lead_note_entries_insert_own'
  ) then
    create policy "lead_note_entries_insert_own"
      on public.lead_note_entries
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_note_entries'
      and policyname = 'lead_note_entries_delete_own'
  ) then
    create policy "lead_note_entries_delete_own"
      on public.lead_note_entries
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
