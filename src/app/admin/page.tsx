"use client";

import { useEffect, useState } from "react";
import { formatParisShortDate } from "@/lib/calendar";
import type { Attendance, BureauStats, PaidMember, Season, Session } from "@/lib/types";

type ParticipantRow = {
  id: string;
  firstName: string;
  lastName: string;
};

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<BureauStats | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState(false);
  const [paidMembers, setPaidMembers] = useState<PaidMember[]>([]);
  const [importRaw, setImportRaw] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");

  async function refreshAdmin() {
    const ping = await fetch("/api/admin?action=ping");
    const pingData = await ping.json();
    setIsAdmin(Boolean(pingData.admin));
    if (!pingData.admin) {
      return;
    }

    const [main, statsResponse, membersResponse] = await Promise.all([
      fetch("/api/admin"),
      fetch("/api/admin?action=stats"),
      fetch("/api/admin?action=members"),
    ]);
    const mainData = await main.json();
    const statsData = await statsResponse.json();
    const membersData = await membersResponse.json();
    setSeason(mainData.season ?? null);
    setSessions(mainData.sessions ?? []);
    setStats(statsData.stats ?? null);
    setPaidMembers(membersData.members ?? []);
  }

  useEffect(() => {
    void refreshAdmin();
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", pin }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      await refreshAdmin();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function createSeason() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "season.create", startYear }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      await refreshAdmin();
    } catch (seasonError) {
      setError(seasonError instanceof Error ? seasonError.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function updateSession(sessionId: string, patch: Partial<Session>) {
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "session.update",
        sessionId,
        ...patch,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    setSessions((current) => current.map((session) => (session.id === sessionId ? data.session : session)));
  }

  async function openAttendance(sessionId: string) {
    setSelectedSessionId(sessionId);
    const response = await fetch(`/api/admin?sessionId=${sessionId}`);
    const data = await response.json();
    setParticipants(data.participants ?? []);
    setAttendance(data.attendance ?? []);
  }

  async function markAttendance(participantId: string, status: Attendance["status"]) {
    if (!selectedSessionId) {
      return;
    }
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "attendance.mark",
        sessionId: selectedSessionId,
        participantId,
        status,
      }),
    });
    const data = await response.json();
    if (response.ok) {
      setAttendance(data.attendance ?? []);
    }
  }

  async function importMembers() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "members.import", raw: importRaw, mode: importMode }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      setPaidMembers(data.members ?? []);
      setImportRaw("");
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function clearMembers() {
    if (!window.confirm("Vider la liste des adhérents à jour ?")) {
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "members.clear" }),
      });
      setPaidMembers([]);
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="container max-w-md">
        <section className="card p-6">
          <h1 className="text-2xl font-bold">Admin PPG</h1>
          <p className="muted mt-2">Accès réservé à Manon et au bureau.</p>
          <form className="mt-6 space-y-4" onSubmit={login}>
            <label className="block space-y-1">
              <span className="text-sm font-medium">PIN admin</span>
              <input className="input" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" />
            </label>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "..." : "Entrer"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;

  return (
    <div className="container space-y-6">
      <section className="card p-6">
        <h1 className="text-2xl font-bold">Administration PPG</h1>
        {season ? (
          <p className="muted mt-2">
            Saison active {season.label} · {formatParisShortDate(`${season.startYear}-09-01`)} → jeudis générés
          </p>
        ) : (
          <p className="muted mt-2">Aucune saison active.</p>
        )}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="text-sm font-medium">Année de début (septembre)</span>
            <input
              className="input"
              type="number"
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={createSeason} disabled={busy}>
            Créer la saison
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-bold">Adhérents à jour (adhésion payée)</h2>
        <p className="muted mt-2 text-sm">
          Importez la liste des membres du club. Seules ces personnes pourront créer un profil PPG. Format : une ligne
          par personne, « Prénom Nom » ou « Prénom;Nom » (CSV).
        </p>
        {paidMembers.length === 0 ? (
          <p className="mt-3 rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            Liste vide : les inscriptions publiques sont bloquées tant que cette liste n&apos;est pas importée.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={importMode === "replace"}
              onChange={() => setImportMode("replace")}
            />
            Remplacer la liste
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={importMode === "merge"} onChange={() => setImportMode("merge")} />
            Ajouter à la liste
          </label>
        </div>
        <textarea
          className="input mt-3 min-h-40 font-mono text-sm"
          placeholder={"Suzanne Huss\nPhilippe Lacues\nMarina;Dupont"}
          value={importRaw}
          onChange={(e) => setImportRaw(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={importMembers} disabled={busy || !importRaw.trim()}>
            Importer
          </button>
          <button type="button" className="btn btn-danger" onClick={clearMembers} disabled={busy || paidMembers.length === 0}>
            Vider la liste
          </button>
          <span className="muted self-center text-sm">{paidMembers.length} membre{paidMembers.length > 1 ? "s" : ""}</span>
        </div>
        {paidMembers.length > 0 ? (
          <ul className="mt-4 max-h-48 overflow-auto rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
            {paidMembers.map((member) => (
              <li key={member.id} className="px-3 py-2 text-sm">
                {member.firstName} {member.lastName}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {stats ? (
        <section className="card p-6">
          <h2 className="text-xl font-bold">Stats bureau</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-semibold">Mois avec le plus d&apos;absences</h3>
              <ul className="muted mt-2 space-y-1 text-sm">
                {[...stats.months]
                  .sort((a, b) => b.absences - a.absences)
                  .slice(0, 5)
                  .map((month) => (
                    <li key={month.month}>
                      {month.month} · {month.absences} absence{month.absences > 1 ? "s" : ""} / {month.sessions} séance
                      {month.sessions > 1 ? "s" : ""}
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">Dernières séances</h3>
              <ul className="muted mt-2 space-y-1 text-sm">
                {stats.sessions
                  .slice(-5)
                  .reverse()
                  .map((session) => (
                    <li key={session.id}>
                      {formatParisShortDate(session.sessionDate)} · {session.registered} inscrits ·{" "}
                      {session.attendanceRate}% présents
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-xl font-bold">Séances</h2>
          <div className="mt-4 max-h-[70vh] space-y-4 overflow-auto">
            {sessions.map((session) => (
              <article key={session.id} className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{formatParisShortDate(session.sessionDate)}</p>
                  <select
                    className="input max-w-[10rem]"
                    value={session.status}
                    onChange={(e) =>
                      updateSession(session.id, {
                        status: e.target.value as Session["status"],
                      })
                    }
                  >
                    <option value="scheduled">Programmée</option>
                    <option value="cancelled">Annulée</option>
                    <option value="rescheduled">Reportée</option>
                  </select>
                </div>
                <input
                  className="input mt-2"
                  placeholder="Thème de la séance"
                  defaultValue={session.theme ?? ""}
                  onBlur={(e) => updateSession(session.id, { theme: e.target.value })}
                />
                <textarea
                  className="input mt-2 min-h-20"
                  placeholder="Notes / consignes"
                  defaultValue={session.notes ?? ""}
                  onBlur={(e) => updateSession(session.id, { notes: e.target.value })}
                />
                <button type="button" className="btn btn-secondary mt-3" onClick={() => openAttendance(session.id)}>
                  Feuille de présence
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold">Présence</h2>
          {!selectedSession ? (
            <p className="muted mt-2">Sélectionnez une séance.</p>
          ) : (
            <>
              <p className="mt-2 font-medium">{formatParisShortDate(selectedSession.sessionDate)}</p>
              <ul className="mt-4 space-y-2">
                {participants.map((participant) => {
                  const record = attendance.find((item) => item.participantId === participant.id);
                  return (
                    <li
                      key={participant.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bg)] px-3 py-2"
                    >
                      <span>
                        {participant.firstName} {participant.lastName}
                      </span>
                      <div className="flex gap-1">
                        {(["present", "absent", "excused"] as const).map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={
                              record?.status === status ? "btn btn-primary text-xs" : "btn btn-secondary text-xs"
                            }
                            onClick={() => markAttendance(participant.id, status)}
                          >
                            {status === "present" ? "Présent" : status === "absent" ? "Absent" : "Excusé"}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
