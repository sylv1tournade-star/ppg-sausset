-- Sécurité Supabase : activer RLS sur toutes les tables PPG.
-- L'application Next.js passe uniquement par la clé service_role (serveur),
-- qui contourne RLS. La clé anon/publishable ne doit accéder à aucune donnée.

alter table if exists ppg_seasons enable row level security;
alter table if exists ppg_sessions enable row level security;
alter table if exists ppg_participants enable row level security;
alter table if exists ppg_registrations enable row level security;
alter table if exists ppg_attendance enable row level security;
alter table if exists ppg_paid_members enable row level security;
alter table if exists ppg_treasurer_emails enable row level security;
alter table if exists ppg_month_validations enable row level security;
alter table if exists ppg_month_reminders enable row level security;

alter table if exists ppg_seasons force row level security;
alter table if exists ppg_sessions force row level security;
alter table if exists ppg_participants force row level security;
alter table if exists ppg_registrations force row level security;
alter table if exists ppg_attendance force row level security;
alter table if exists ppg_paid_members force row level security;
alter table if exists ppg_treasurer_emails force row level security;
alter table if exists ppg_month_validations force row level security;
alter table if exists ppg_month_reminders force row level security;

revoke all on table ppg_seasons from anon, authenticated;
revoke all on table ppg_sessions from anon, authenticated;
revoke all on table ppg_participants from anon, authenticated;
revoke all on table ppg_registrations from anon, authenticated;
revoke all on table ppg_attendance from anon, authenticated;
revoke all on table ppg_paid_members from anon, authenticated;
revoke all on table ppg_treasurer_emails from anon, authenticated;
revoke all on table ppg_month_validations from anon, authenticated;
revoke all on table ppg_month_reminders from anon, authenticated;

-- Aucune policy publique : accès refusé via la clé anon.
-- Le service_role (API Next.js) continue de fonctionner normalement.
