do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meetings' and column_name = 'user_id'
  ) then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'meetings' and policyname = 'meetings_delete_own'
    ) then
      create policy "meetings_delete_own"
        on public.meetings
        for delete
        using (auth.uid() = user_id);
    end if;
  end if;
end $$;
