import Link from "next/link";
import { getParticipantToken } from "@/lib/auth";
import { enrichSessions, getActiveSeason, getParticipantByToken, getRanking, getSessionsForSeason } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SessionCalendarView } from "@/components/session-calendar-view";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container space-y-4">
        <section className="card p-6">
          <h1 className="text-2xl font-bold">PPG Courir à Sausset</h1>
          <p className="muted mt--2">
            Configurez Supabase dans <code>.env.local</code> puis exécutez le schéma SQL.
          </p>
        </section>
      </div>
    );
  }

  const season = await getActiveSeason();
  if (!season) {
    return (
      <div className="container space-y-4">
        <section className="card p-6">
          <h1 className="text-2xl font-bold">Aucune saison active</h1>
          <p className="muted mt-2">Manon peut créer la saison depuis l&apos;admin.</p>
          <Link href="/admin" className="btn btn-primary mt-4">
            Aller à l&apos;admin
          </Link>
        </section>
      </div>
    );
  }

  const token = await getParticipantToken();
  const participant = token ? await getParticipantByToken(token) : null;
  const [sessions, ranking] = await Promise.all([
    getSessionsForSeason(season.id).then((items) => enrichSessions(items, season, participant?.id ?? null)),
    getRanking(3),
  ]);

  return (
    <div className="container space-y-8">
      <section className="card p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">Saison {season.label}</p>
        <h1 className="mt-1 text-3xl font-bold">Séances PPG du jeudi</h1>
        <p className="muted mt-2">
          Inscrivez-vous aux séances à venir. Chaque inscription peut être ajoutée à votre agenda (rappel 2 h avant,
          heure de Paris).
        </p>
        {!participant ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/inscription" className="btn btn-primary">
              Créer mon profil
            </Link>
            <Link href="/connexion" className="btn btn-secondary">
              J&apos;ai déjà un profil
            </Link>
          </div>
        ) : null}
      </section>

      <SessionCalendarView season={season} sessions={sessions} isLoggedIn={Boolean(participant)} />

      {ranking.length > 0 ? (
        <section className="card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Assiduité</h2>
            <Link href="/classement" className="text-sm font-semibold text-[var(--accent)]">
              Voir le top 10
            </Link>
          </div>
          <ol className="mt-4 space-y-2">
            {ranking.map((entry, index) => (
              <li key={entry.participantId} className="flex items-center justify-between rounded-xl bg-[var(--bg)] px-4 py-2">
                <span>
                  {index + 1}. {entry.firstName} {entry.lastName}
                </span>
                <span className="muted text-sm">
                  {entry.presentCount}/{entry.registeredCount} ({entry.rate}%)
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
