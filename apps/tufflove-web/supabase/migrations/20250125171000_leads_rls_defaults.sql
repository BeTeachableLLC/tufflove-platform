alter table leads add column if not exists user_id uuid;
alter table leads alter column user_id set default auth.uid();
alter table leads enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_select_own'
  ) then
    create policy "leads_select_own"
      on public.leads
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_insert_own'
  ) then
    create policy "leads_insert_own"
      on public.leads
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_update_own'
  ) then
    create policy "leads_update_own"
      on public.leads
      for update
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_delete_own'
  ) then
    create policy "leads_delete_own"
      on public.leads
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
