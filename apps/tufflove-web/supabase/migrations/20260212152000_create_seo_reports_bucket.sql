insert into storage.buckets (id, name, public)
values ('seo-reports', 'seo-reports', false)
on conflict (id) do nothing;
