-- PPG Courir à Sausset — schéma dédié (projet Supabase séparé de Challenge CAS)

create table if not exists ppg_seasons (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  start_year integer not null,
  day_of_week integer not null default 4 check (day_of_week between 0 and 6),
  start_time time not null default '19:00',
  end_time time not null default '20:00',
  location text not null default 'Sausset-les-Pins',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists ppg_sessions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references ppg_seasons(id) on delete cascade,
  session_date date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'rescheduled')),
  theme text,
  notes text,
  created_at timestamptz not null default now(),
  unique (season_id, session_date)
);

create table if not exists ppg_participants (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  access_token text not null unique,
  created_at timestamptz not null default now(),
  unique (email)
);

create table if not exists ppg_registrations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references ppg_sessions(id) on delete cascade,
  participant_id uuid not null references ppg_participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, participant_id)
);

create table if not exists ppg_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references ppg_sessions(id) on delete cascade,
  participant_id uuid not null references ppg_participants(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'excused')),
  marked_at timestamptz not null default now(),
  unique (session_id, participant_id)
);

create index if not exists idx_ppg_sessions_season on ppg_sessions(season_id);
create index if not exists idx_ppg_sessions_date on ppg_sessions(session_date);
create index if not exists idx_ppg_registrations_session on ppg_registrations(session_id);
create index if not exists idx_ppg_registrations_participant on ppg_registrations(participant_id);
create index if not exists idx_ppg_attendance_session on ppg_attendance(session_id);
create index if not exists idx_ppg_participants_token on ppg_participants(access_token);
create index if not exists idx_ppg_participants_email on ppg_participants(email);

create table if not exists ppg_paid_members (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references ppg_seasons(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  normalized_key text not null,
  imported_at timestamptz not null default now(),
  unique (season_id, normalized_key)
);

create index if not exists idx_ppg_paid_members_season on ppg_paid_members(season_id);
create index if not exists idx_ppg_paid_members_key on ppg_paid_members(season_id, normalized_key);

create table if not exists ppg_treasurer_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  label text,
  recipient_type text not null default 'treasurer'
    check (recipient_type in ('treasurer', 'coach', 'billing_manager')),
  created_at timestamptz not null default now()
);

create index if not exists idx_ppg_treasurer_emails_type on ppg_treasurer_emails(recipient_type);

create table if not exists ppg_month_validations (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references ppg_seasons(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  computed_session_count integer not null,
  billed_session_count integer not null,
  billing_note text,
  session_snapshot jsonb not null default '[]'::jsonb,
  last_sent_at timestamptz,
  send_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, year, month)
);

create index if not exists idx_ppg_month_validations_season on ppg_month_validations(season_id);

create table if not exists ppg_month_reminders (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references ppg_seasons(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  sent_at timestamptz not null default now(),
  unique (season_id, year, month)
);

-- Row Level Security : bloquer l'accès direct via la clé anon/publishable.
-- L'app Next.js utilise uniquement service_role côté serveur.

alter table ppg_seasons enable row level security;
alter table ppg_sessions enable row level security;
alter table ppg_participants enable row level security;
alter table ppg_registrations enable row level security;
alter table ppg_attendance enable row level security;
alter table ppg_paid_members enable row level security;
alter table ppg_treasurer_emails enable row level security;
alter table ppg_month_validations enable row level security;
alter table ppg_month_reminders enable row level security;

alter table ppg_seasons force row level security;
alter table ppg_sessions force row level security;
alter table ppg_participants force row level security;
alter table ppg_registrations force row level security;
alter table ppg_attendance force row level security;
alter table ppg_paid_members force row level security;
alter table ppg_treasurer_emails force row level security;
alter table ppg_month_validations force row level security;
alter table ppg_month_reminders force row level security;

revoke all on table ppg_seasons from anon, authenticated;
revoke all on table ppg_sessions from anon, authenticated;
revoke all on table ppg_participants from anon, authenticated;
revoke all on table ppg_registrations from anon, authenticated;
revoke all on table ppg_attendance from anon, authenticated;
revoke all on table ppg_paid_members from anon, authenticated;
revoke all on table ppg_treasurer_emails from anon, authenticated;
revoke all on table ppg_month_validations from anon, authenticated;
revoke all on table ppg_month_reminders from anon, authenticated;
