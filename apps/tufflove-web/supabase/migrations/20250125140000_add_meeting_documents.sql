create table if not exists meeting_documents (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  file_name text not null,
  file_path text not null,
  mime_type text,
  size_bytes bigint,
  notes text,
  text_content text,
  created_at timestamptz not null default now()
);

create index if not exists idx_meeting_documents_meeting_id
  on meeting_documents(meeting_id, created_at);

alter table meeting_documents enable row level security;

create policy "meeting_documents_select_own"
  on meeting_documents
  for select
  using (auth.uid() = user_id);

create policy "meeting_documents_insert_own"
  on meeting_documents
  for insert
  with check (auth.uid() = user_id);

create policy "meeting_documents_update_own"
  on meeting_documents
  for update
  using (auth.uid() = user_id);

create policy "meeting_documents_delete_own"
  on meeting_documents
  for delete
  using (auth.uid() = user_id);
