-- Destinataires facturation par rôle + rappels mensuels

alter table ppg_treasurer_emails
  add column if not exists recipient_type text not null default 'treasurer'
  check (recipient_type in ('treasurer', 'coach', 'billing_manager'));

create index if not exists idx_ppg_treasurer_emails_type on ppg_treasurer_emails(recipient_type);

create table if not exists ppg_month_reminders (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references ppg_seasons(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  sent_at timestamptz not null default now(),
  unique (season_id, year, month)
);
