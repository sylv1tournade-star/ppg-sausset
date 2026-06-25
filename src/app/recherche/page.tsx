"use client";

import { useEffect, useState } from "react";
import { formatParisShortDate } from "@/lib/calendar";
import type { Participant, SessionWithMeta } from "@/lib/types";

export default function RecherchePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Participant | null>(null);
  const [sessions, setSessions] = useState<SessionWithMeta[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setResults(data.results ?? []);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  async function selectParticipant(participant: Participant) {
    setSelected(participant);
    setBusy(true);
    try {
      const response = await fetch(`/api/search?participantId=${participant.id}`);
      const data = await response.json();
      setSessions(data.sessions ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container max-w-3xl space-y-6">
      <section className="card p-6">
        <h1 className="text-2xl font-bold">Rechercher un participant</h1>
        <p className="muted mt-2">Voir sur quelles séances une personne est inscrite.</p>
        <input
          className="input mt-4"
          placeholder="Prénom, nom ou e-mail"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setSessions([]);
          }}
        />
        {results.length > 0 && !selected ? (
          <ul className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
            {results.map((participant) => (
              <li key={participant.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg)]"
                  onClick={() => selectParticipant(participant)}
                >
                  <span>
                    {participant.firstName} {participant.lastName}
                  </span>
                  <span className="muted text-sm">{participant.email}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {selected ? (
        <section className="card p-6">
          <h2 className="text-xl font-bold">
            Inscriptions de {selected.firstName} {selected.lastName}
          </h2>
          {busy ? (
            <p className="muted mt-2">Chargement...</p>
          ) : sessions.length === 0 ? (
            <p className="muted mt-2">Aucune inscription trouvée.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {sessions.map((session) => (
                <li key={session.id} className="rounded-xl bg-[var(--bg)] px-4 py-3">
                  <p className="font-medium">{formatParisShortDate(session.sessionDate)}</p>
                  {session.theme ? <p className="muted text-sm">{session.theme}</p> : null}
                  {session.status === "cancelled" ? <span className="badge badge-danger mt-1">Annulée</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
