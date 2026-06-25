"use client";

import { useMemo, useState } from "react";
import { findNextOpenSession, formatParisShortDate } from "@/lib/calendar";
import { SessionCalendarView } from "@/components/session-calendar-view";
import type { Season, SessionWithMeta } from "@/lib/types";

type Props = {
  season: Season;
  sessions: SessionWithMeta[];
  isLoggedIn: boolean;
};

export function HomeSessionsPanel({ season, sessions, isLoggedIn }: Props) {
  const [focusSessionId, setFocusSessionId] = useState<string | null>(null);

  const nextSession = useMemo(() => findNextOpenSession(sessions, season), [sessions, season]);

  return (
    <div className="space-y-4">
      {isLoggedIn && nextSession ? (
        <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">Prochaine séance</p>
            <p className="mt-1 text-lg font-bold">{formatParisShortDate(nextSession.sessionDate)} · 19h</p>
            <p className="muted text-sm">
              {nextSession.isRegistered
                ? "Vous êtes inscrit(e)."
                : `${nextSession.registrationCount} inscrit${nextSession.registrationCount > 1 ? "s" : ""} pour le moment.`}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFocusSessionId(nextSession.id)}
          >
            {nextSession.isRegistered ? "Voir la séance" : "S'inscrire"}
          </button>
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
