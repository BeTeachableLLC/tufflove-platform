alter table meetings add column if not exists meeting_notes text;
alter table meetings add column if not exists assistant_notes text;

create table if not exists meeting_assistant_sessions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_meeting_assistant_sessions_meeting_id
  on meeting_assistant_sessions(meeting_id, created_at);

update meetings set meeting_notes = coalesce(meeting_notes, summary);
