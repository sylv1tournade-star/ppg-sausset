import Link from "next/link";
import { getPersonalLink, getParticipantToken } from "@/lib/auth";
import { formatParisShortDate } from "@/lib/calendar";
import { getParticipantByToken, getParticipantSessions } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { LogoutButton } from "@/components/logout-button";

export default async function MoiPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container">
        <section className="card p-6">Supabase non configuré.</section>
      </div>
    );
  }

  const token = await getParticipantToken();
  if (!token) {
    return (
      <div className="container max-w-xl space-y-4">
        <section className="card p-6">
          <h1 className="text-2xl font-bold">Mon espace</h1>
          <p className="muted mt-2">Connectez-vous pour gérer vos inscriptions.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/connexion" className="btn btn-primary">
              Se connecter
            </Link>
            <Link href="/inscription" className="btn btn-secondary">
              Créer un profil
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const participant = await getParticipantByToken(token);
  if (!participant) {
    return (
      <div className="container max-w-xl">
        <section className="card p-6">
          <p>Session expirée.</p>
          <Link href="/connexion" className="btn btn-primary mt-4">
            Se reconnecter
          </Link>
        </section>
      </div>
    );
  }

  const { season, sessions } = await getParticipantSessions(participant.id);
  const personalLink = getPersonalLink(participant.accessToken);
  const upcoming = [...sessions].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

  return (
    <div className="container max-w-3xl space-y-6">
      <section className="card p-6">
        <h1 className="text-2xl font-bold">
          Bonjour {participant.firstName} {participant.lastName}
        </h1>
        <p className="muted mt-1 text-sm">{participant.email}</p>
        <p className="mt-4 text-sm">
          Lien personnel à conserver : <code className="rounded bg-[var(--bg)] px-2 py-1">{personalLink}</code>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/" className="btn btn-primary">
            S&apos;inscrire à une séance
          </Link>
          <LogoutButton />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-bold">Mes inscriptions</h2>
        {!season ? (
          <p className="muted mt-2">Aucune saison active.</p>
        ) : upcoming.length === 0 ? (
          <p className="muted mt-2">Aucune inscription pour le moment.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {upcoming.map((session) => (
              <li key={session.id} className="flex items-center justify-between rounded-xl bg-[var(--bg)] px-4 py-3">
                <div>
                  <p className="font-medium">{formatParisShortDate(session.sessionDate)}</p>
                  {session.theme ? <p className="muted text-sm">{session.theme}</p> : null}
                </div>
                <div className="flex gap-2">
                  <a className="btn btn-secondary text-sm" href={`/api/calendar/${session.id}?format=ics`}>
                    .ics
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
