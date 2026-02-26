do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'user_id'
  ) then
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
  end if;
end $$;
