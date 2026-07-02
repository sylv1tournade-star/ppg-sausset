"use client";

import { useMemo, useState } from "react";
import {
  findNextOpenSession,
  findNextOpenSessionNotRegistered,
  formatParisShortDate,
  formatTimeLabel,
} from "@/lib/calendar";
import { SessionCalendarView } from "@/components/session-calendar-view";
import type { Season, SessionWithMeta } from "@/lib/types";

type Props = {
  season: Season;
  sessions: SessionWithMeta[];
  isLoggedIn: boolean;
};

export function HomeSessionsPanel({ season, sessions: initialSessions, isLoggedIn }: Props) {
  const [sessions, setSessions] = useState(initialSessions);
  const [focusSessionId, setFocusSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextToRegister = useMemo(
    () => findNextOpenSessionNotRegistered(sessions, season),
    [sessions, season],
  );
  const nextSession = useMemo(() => findNextOpenSession(sessions, season), [sessions, season]);
  const bannerSession = nextToRegister ?? nextSession;
  const timeLabel = `${formatTimeLabel(season.startTime)}-${formatTimeLabel(season.endTime)}`;

  async function toggleBannerRegistration(register: boolean) {
    if (!bannerSession) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: bannerSession.id,
          action: register ? "register" : "unregister",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      setSessions(data.sessions as SessionWithMeta[]);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {isLoggedIn && bannerSession ? (
        <section className="card border-2 border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-soft)] to-white p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
            {nextToRegister ? "Prochaine séance — inscription ouverte" : "Prochaine séance"}
          </p>
          <p className="mt-2 text-2xl font-bold">{formatParisShortDate(bannerSession.sessionDate)}</p>
          <p className="muted mt-1 text-sm">
            {timeLabel} · {season.location}
            {bannerSession.theme?.trim() ? ` · ${bannerSession.theme.trim()}` : ""}
          </p>
          <p className="mt-3 text-sm">
            {nextToRegister ? (
              <>
                Vous n&apos;êtes pas encore inscrit(e) à cette date.{" "}
                <span className="muted">
                  ({bannerSession.registrationCount} inscrit
                  {bannerSession.registrationCount > 1 ? "s" : ""} pour le moment)
                </span>
              </>
            ) : (
              <>Vous êtes inscrit(e) à la prochaine séance ouverte.</>
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {nextToRegister ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void toggleBannerRegistration(true)}
              >
                {busy ? "..." : "S'inscrire à cette séance"}
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setFocusSessionId(bannerSession.id)}>
                  Voir la séance
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => void toggleBannerRegistration(false)}
                >
                  {busy ? "..." : "Se désinscrire"}
                </button>
              </>
            )}
          </div>
          {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
        </section>
      ) : null}

      <SessionCalendarView
        season={season}
        sessions={sessions}
        isLoggedIn={isLoggedIn}
        focusSessionId={focusSessionId}
      />
    </div>
  );
}
