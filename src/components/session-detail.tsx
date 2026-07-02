"use client";

import { useEffect, useState } from "react";
import { formatParisDate, isSessionPast, isSessionRegisterable } from "@/lib/calendar";
import type { Season, SessionWithMeta } from "@/lib/types";

type Props = {
  session: SessionWithMeta;
  season: Season;
  isLoggedIn: boolean;
  onSessionsUpdate: (sessions: SessionWithMeta[]) => void;
};

export function SessionDetail({ session, season, isLoggedIn, onSessionsUpdate }: Props) {
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(Boolean(session.isRegistered));
  const [participants, setParticipants] = useState(session.participants ?? []);
  const [count, setCount] = useState(session.registrationCount);
  const [message, setMessage] = useState<string | null>(null);

  const past = isSessionPast(session.sessionDate, season.endTime);
  const cancelled = session.status === "cancelled";
  const rescheduled = session.status === "rescheduled";
  const registerable = isSessionRegisterable(session, season);

  useEffect(() => {
    setRegistered(Boolean(session.isRegistered));
    setParticipants(session.participants ?? []);
    setCount(session.registrationCount);
    setMessage(null);
  }, [session]);

  async function toggleRegistration() {
    if (!isLoggedIn) {
      window.location.href = "/connexion";
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: registered ? "unregister" : "register",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      const updatedSessions = data.sessions as SessionWithMeta[];
      onSessionsUpdate(updatedSessions);
      const updated = updatedSessions.find((item) => item.id === session.id);
      if (updated) {
        setRegistered(Boolean(updated.isRegistered));
        setCount(updated.registrationCount);
        setParticipants(updated.participants ?? []);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function openCalendar() {
    const response = await fetch(`/api/calendar/${session.id}`);
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Impossible de générer l'agenda.");
      return;
    }
    window.open(data.googleUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <article className="card p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
        {formatParisDate(session.sessionDate)}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {registered && !past && !cancelled ? <span className="badge badge-ok">Inscrit</span> : null}
        {cancelled ? <span className="badge badge-danger">Annulée</span> : null}
        {rescheduled ? <span className="badge badge-warn">Reportée</span> : null}
        {!cancelled && !rescheduled && past ? <span className="badge badge-warn">Passée</span> : null}
        <span className="badge badge-ok">
          {count} inscrit{count > 1 ? "s" : ""}
        </span>
      </div>

      {session.theme ? <p className="mt-3 font-medium">{session.theme}</p> : null}
      {session.notes ? <p className="muted mt-2 text-sm">{session.notes}</p> : null}

      <div className="mt-4">
        <h3 className="text-sm font-semibold">Inscrits</h3>
        {participants.length === 0 ? (
          <p className="muted mt-2 text-sm">Personne inscrit pour le moment.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {participants.map((participant) => (
              <li
                key={participant.id}
                className="rounded-full bg-[var(--bg)] px-3 py-1 text-sm"
              >
                {participant.firstName} {participant.lastName}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {registerable && !registered ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={toggleRegistration}>
            {busy ? "..." : "S'inscrire"}
          </button>
        ) : null}
        {registered && !past ? (
          <button type="button" className="btn btn-danger" disabled={busy} onClick={toggleRegistration}>
            {busy ? "..." : "Se désinscrire"}
          </button>
        ) : null}
        {registered && !cancelled ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={openCalendar}>
              Google Agenda
            </button>
            <a className="btn btn-secondary" href={`/api/calendar/${session.id}?format=ics`}>
              Fichier .ics
            </a>
          </>
        ) : null}
        <a className="btn btn-secondary" href={`/seance/${session.id}`}>
          Lien séance
        </a>
      </div>
      {message ? <p className="mt-3 text-sm text-[var(--danger)]">{message}</p> : null}
    </article>
  );
}
