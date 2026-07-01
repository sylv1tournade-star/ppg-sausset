-- Facturation PPG : e-mails trésoriers + validations mensuelles

create table if not exists ppg_treasurer_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  label text,
  created_at timestamptz not null default now()
);

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
