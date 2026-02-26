alter table leads add column if not exists research_status text;
alter table leads add column if not exists verified_email text;
alter table leads add column if not exists verified_phone text;
alter table leads add column if not exists linkedin_url text;
alter table leads add column if not exists ai_generated_script text;
alter table leads add column if not exists research_last_run timestamptz;
alter table leads add column if not exists research_error text;
