do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'companies'
      and policyname = 'companies_select_owner'
  ) then
    create policy "companies_select_owner"
      on public.companies
      for select
      using (owner_user_id = auth.uid());
  end if;
end $$;
