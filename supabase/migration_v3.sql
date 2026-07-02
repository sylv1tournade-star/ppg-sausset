-- Rappels e-mail veille de séance + préférences désabonnement

alter table ppg_participants
  add column if not exists email_reminders_enabled boolean not null default true;

create table if not exists ppg_session_reminders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references ppg_sessions(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (session_id)
);

create index if not exists idx_ppg_session_reminders_session on ppg_session_reminders(session_id);

alter table ppg_session_reminders enable row level security;
alter table ppg_session_reminders force row level security;
revoke all on table ppg_session_reminders from anon, authenticated;
