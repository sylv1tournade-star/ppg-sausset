"use client";

import { useState } from "react";
import { formatParisShortDate, isSessionPast } from "@/lib/calendar";
import type { Season, SessionWithMeta } from "@/lib/types";

type Props = {
  season: Season;
  sessions: SessionWithMeta[];
};

export function MyRegistrationsList({ season, sessions }: Props) {
  const [items, setItems] = useState(
    [...sessions].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unregister(sessionId: string) {
    setBusyId(sessionId);
    setError(null);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "unregister" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      setItems((current) => current.filter((session) => session.id !== sessionId));
    } catch (unregisterError) {
      setError(unregisterError instanceof Error ? unregisterError.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <p className="muted mt-2">Aucune inscription pour le moment.</p>;
  }

  return (
    <>
      <ul className="mt-4 space-y-2">
        {items.map((session) => {
          const past = isSessionPast(session.sessionDate, season.endTime);
          const cancelled = session.status === "cancelled";
          const rescheduled = session.status === "rescheduled";
          return (
            <li key={session.id} className="rounded-xl bg-[var(--bg)] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{formatParisShortDate(session.sessionDate)}</p>
                  {session.theme ? <p className="muted text-sm">{session.theme}</p> : null}
                  <div className="mt-1 flex flex-wrap gap-2">
                    {cancelled ? <span className="badge badge-danger">Annulée</span> : null}
                    {rescheduled ? <span className="badge badge-warn">Reportée</span> : null}
                    {past && !cancelled && !rescheduled ? <span className="badge badge-warn">Passée</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!past && !cancelled && !rescheduled ? (
                    <button
                      type="button"
                      className="btn btn-danger text-sm"
                      disabled={busyId === session.id}
                      onClick={() => unregister(session.id)}
                    >
                      {busyId === session.id ? "..." : "Se désinscrire"}
                    </button>
                  ) : null}
                  <a className="btn btn-secondary text-sm" href={`/api/calendar/${session.id}?format=ics`}>
                    .ics
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
    </>
  );
}
