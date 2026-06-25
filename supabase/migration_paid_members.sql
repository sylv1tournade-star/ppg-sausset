-- À exécuter si la base existait avant l'ajout de la liste adhérents
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
