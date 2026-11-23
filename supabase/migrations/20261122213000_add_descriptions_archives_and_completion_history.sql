begin;

alter table public.projects
  add column if not exists description text not null default '',
  add column if not exists archived_at timestamptz;

alter table public.tasks
  add column if not exists description text not null default '',
  add column if not exists completed_at timestamptz;

commit;
