do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'company_members'
      and policyname = 'company_members_insert_owner'
  ) then
    create policy "company_members_insert_owner"
      on public.company_members
      for insert
      with check (
        auth.uid() = user_id
        and exists (
          select 1
          from public.companies c
          where c.id = company_id
            and c.owner_user_id = auth.uid()
        )
      );
  end if;
end $$;
