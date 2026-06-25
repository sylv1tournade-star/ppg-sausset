import Link from "next/link";
import { getPersonalLink, getParticipantToken } from "@/lib/auth";
import { findNextOpenSession, formatParisShortDate } from "@/lib/calendar";
import { getParticipantAssiduity, getParticipantByToken, getParticipantSessions, getSessionsForSeason, enrichSessions } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { LogoutButton } from "@/components/logout-button";
import { MyRegistrationsList } from "@/components/my-registrations-list";

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
  const assiduity = season ? await getParticipantAssiduity(participant.id) : null;
  const personalLink = getPersonalLink(participant.accessToken);
  const allSessions =
    season ? await enrichSessions(await getSessionsForSeason(season.id), season, participant.id) : [];
  const nextSession = season ? findNextOpenSession(allSessions, season) : null;

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

      {nextSession ? (
        <section className="card p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">Prochaine séance</p>
          <p className="mt-1 text-lg font-bold">{formatParisShortDate(nextSession.sessionDate)} · 19h</p>
          <p className="muted mt-1 text-sm">
            {nextSession.isRegistered ? "Vous êtes inscrit(e)." : "Pas encore inscrit(e) pour ce jeudi."}
          </p>
          <Link href="/" className="btn btn-secondary mt-4">
            {nextSession.isRegistered ? "Voir sur le calendrier" : "S'inscrire maintenant"}
          </Link>
        </section>
      ) : null}

      {assiduity && assiduity.registeredCount > 0 ? (
        <section className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Mon assiduité</h2>
              <p className="muted mt-2 text-sm">Sur les séances passées où vous étiez inscrit(e).</p>
            </div>
            <span className="text-2xl font-bold text-[var(--accent)]">{assiduity.rate}%</span>
          </div>
          <p className="mt-4 text-sm">
            <strong>{assiduity.presentCount}</strong> présence{assiduity.presentCount > 1 ? "s" : ""} sur{" "}
            <strong>{assiduity.registeredCount}</strong> inscription{assiduity.registeredCount > 1 ? "s" : ""}
          </p>
          <Link href="/classement" className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)]">
            Voir le classement
          </Link>
        </section>
      ) : null}

      <section className="card p-6">
        <h2 className="text-xl font-bold">Mes inscriptions</h2>
        {!season ? (
          <p className="muted mt-2">Aucune saison active.</p>
        ) : (
          <MyRegistrationsList season={season} sessions={sessions} />
        )}
      </section>
    </div>
  );
}
