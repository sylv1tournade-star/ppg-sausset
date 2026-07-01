"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDayOfWeekLongCapitalized, formatMonthYear, formatParisShortDate, formatSeasonScheduleTagline, parseMonthKey } from "@/lib/calendar";
import type { Attendance, BureauStats, PaidMember, Season, Session } from "@/lib/types";

type ParticipantRow = {
  id: string;
  firstName: string;
  lastName: string;
};

type AddableParticipantRow = ParticipantRow;

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<BureauStats | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [addableParticipants, setAddableParticipants] = useState<AddableParticipantRow[]>([]);
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [dayOfWeek, setDayOfWeek] = useState(4);
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("20:00");
  const [location, setLocation] = useState("Sausset-les-Pins");
  const [busy, setBusy] = useState(false);
  const [paidMembers, setPaidMembers] = useState<PaidMember[]>([]);
  const [exportingMonth, setExportingMonth] = useState<string | null>(null);
  const [superAdminConfigured, setSuperAdminConfigured] = useState(true);

  const seasonMonthKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const session of sessions) {
      keys.add(session.sessionDate.slice(0, 7));
    }
    return Array.from(keys).sort();
  }, [sessions]);

  async function refreshAdmin() {
    const ping = await fetch("/api/admin?action=ping");
    const pingData = await ping.json();
    setIsAdmin(Boolean(pingData.admin));
    setIsSuperAdmin(Boolean(pingData.superAdmin));
    setSuperAdminConfigured(pingData.superAdminConfigured !== false);
    if (!pingData.admin) {
      return;
    }

    const [main, statsResponse, membersResponse] = await Promise.all([
      fetch("/api/admin"),
      pingData.superAdmin ? fetch("/api/admin?action=stats") : Promise.resolve(null),
      pingData.superAdmin ? fetch("/api/admin/billing?action=members") : Promise.resolve(null),
    ]);
    const mainData = await main.json();
    const statsData = statsResponse ? await statsResponse.json() : { stats: null };
    const membersData = membersResponse ? await membersResponse.json() : { members: [] };
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
        body: JSON.stringify({ action: "login", pin: pin.trim() }),
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

  async function adminLogout() {
    setBusy(true);
    try {
      await fetch("/api/admin", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      window.location.href = "/admin";
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
        body: JSON.stringify({
          action: "season.create",
          startYear,
          dayOfWeek,
          startTime,
          endTime,
          location,
        }),
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
    if (data.notification?.sent > 0) {
      setNotice(`${data.notification.sent} e-mail(s) d'annulation/report envoyé(s) aux inscrits.`);
    } else if (data.notification?.skipped && data.notification.reason === "BREVO_NOT_CONFIGURED") {
      setNotice("Séance mise à jour, mais Brevo n'est pas configuré : aucun e-mail envoyé.");
    } else {
      setNotice(null);
    }
  }

  async function openAttendance(sessionId: string) {
    setSelectedSessionId(sessionId);
    setAttendanceSearch("");
    const response = await fetch(`/api/admin?sessionId=${sessionId}`);
    const data = await response.json();
    setParticipants(data.participants ?? []);
    setAttendance(data.attendance ?? []);
    setAddableParticipants(data.addable ?? []);
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

  async function markAllPresent() {
    if (!selectedSessionId || participants.length === 0) {
      return;
    }
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "attendance.markAll",
        sessionId: selectedSessionId,
        status: "present",
      }),
    });
    const data = await response.json();
    if (response.ok) {
      setAttendance(data.attendance ?? []);
    }
  }

  async function addParticipantToSession(participantId: string) {
    if (!selectedSessionId) {
      return;
    }
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "attendance.add",
        sessionId: selectedSessionId,
        participantId,
      }),
    });
    const data = await response.json();
    if (response.ok) {
      setParticipants(data.participants ?? []);
      setAttendance(data.attendance ?? []);
      setAddableParticipants(data.addable ?? []);
    }
  }

  async function downloadMonthPdf(monthKey: string) {
    const { year, month } = parseMonthKey(monthKey);
    setExportingMonth(monthKey);
    setError(null);
    try {
      const response = await fetch(`/api/admin/export-month?year=${year}&month=${month + 1}`);
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Impossible de générer le PDF.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ppg-inscriptions-${monthKey}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Erreur");
    } finally {
      setExportingMonth(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="container max-w-md">
        <section className="card p-6">
          <h1 className="text-2xl font-bold">Admin PPG</h1>
          <p className="muted mt-2">Accès coach (Manon) ou responsable PPG (Suzanne).</p>
          {!superAdminConfigured ? (
            <p className="mt-3 rounded-lg border border-[var(--warn)] bg-[#fff3cd] px-3 py-2 text-sm text-[#856404]">
              Le PIN responsable PPG n&apos;est pas encore configuré sur le serveur (variable{" "}
              <code className="text-xs">PPG_SUPER_ADMIN_PIN</code> sur Vercel + redéploiement).
            </p>
          ) : null}
          <form className="mt-6 space-y-4" onSubmit={login}>
            <label className="block space-y-1">
              <span className="text-sm font-medium">PIN</span>
              <input
                className="input"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <p className="muted text-xs">Lettres ou chiffres — le PIN Suzanne ouvre aussi la facturation.</p>
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
  const attendanceQuery = attendanceSearch.trim().toLowerCase();
  const filteredParticipants = participants.filter((participant) => {
    if (!attendanceQuery) {
      return true;
    }
    const full = `${participant.firstName} ${participant.lastName}`.toLowerCase();
    return full.includes(attendanceQuery);
  });

  return (
    <div className="container space-y-6">
      <section className="card p-6">
        <h1 className="text-2xl font-bold">{isSuperAdmin ? "Administration PPG" : "Séances PPG — Manon"}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {isSuperAdmin ? (
            <Link href="/admin/facturation" className="btn btn-secondary text-sm">
              Facturation & adhérents
            </Link>
          ) : null}
          <button type="button" className="btn btn-secondary text-sm" onClick={adminLogout} disabled={busy}>
            Se déconnecter
          </button>
        </div>
        {isSuperAdmin ? (
          season ? (
            <p className="muted mt-2">
              Saison active {season.label} · {formatSeasonScheduleTagline(season)}
            </p>
          ) : (
            <p className="muted mt-2">Aucune saison active.</p>
          )
        ) : (
          <p className="muted mt-2">
            Modifiez le statut, le thème ou les commentaires d&apos;une séance. En cas d&apos;annulation ou de report,
            les inscrits reçoivent un e-mail automatiquement.
          </p>
        )}
        {isSuperAdmin ? (
          <div className="mt-4 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <p className="text-sm font-semibold">Créer une nouvelle saison</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1">
                <span className="text-sm font-medium">Année de début (septembre)</span>
                <input
                  className="input"
                  type="number"
                  value={startYear}
                  onChange={(e) => setStartYear(Number(e.target.value))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Jour de la semaine</span>
                <select className="input" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 0].map((value) => (
                    <option key={value} value={value}>
                      {formatDayOfWeekLongCapitalized(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Heure début</span>
                <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Heure fin</span>
                <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </label>
              <label className="min-w-[12rem] flex-1 space-y-1">
                <span className="text-sm font-medium">Lieu</span>
                <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
              </label>
              <button type="button" className="btn btn-primary" onClick={createSeason} disabled={busy}>
                Créer la saison
              </button>
            </div>
            <p className="muted text-xs">
              Les séances seront générées chaque {formatDayOfWeekLongCapitalized(dayOfWeek)} de septembre à juin. Le
              jour et l&apos;horaire s&apos;affichent sur tout le site pour la saison active.
            </p>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-[var(--accent)]">{notice}</p> : null}
      </section>

      <section className={isSuperAdmin ? "grid gap-6 lg:grid-cols-2" : ""}>
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
                {isSuperAdmin ? (
                  <button type="button" className="btn btn-secondary mt-3" onClick={() => openAttendance(session.id)}>
                    Feuille de présence
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </div>

        {isSuperAdmin ? (
        <div className="card p-6">
          <h2 className="text-xl font-bold">Présence</h2>
          {!selectedSession ? (
            <p className="muted mt-2">Sélectionnez une séance.</p>
          ) : (
            <>
              <p className="mt-2 font-medium">{formatParisShortDate(selectedSession.sessionDate)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  className="input min-w-[12rem] flex-1"
                  placeholder="Rechercher un inscrit"
                  value={attendanceSearch}
                  onChange={(event) => setAttendanceSearch(event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={participants.length === 0}
                  onClick={markAllPresent}
                >
                  Tout marquer présent
                </button>
              </div>
              <ul className="mt-4 space-y-2">
                {filteredParticipants.length === 0 ? (
                  <li className="muted text-sm">Aucun inscrit trouvé.</li>
                ) : (
                  filteredParticipants.map((participant) => {
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
                  })
                )}
              </ul>
              {addableParticipants.length > 0 ? (
                <div className="mt-6 border-t border-[var(--border)] pt-4">
                  <h3 className="text-sm font-semibold">Ajouter un adhérent inscrit au club</h3>
                  <p className="muted mt-1 text-xs">
                    Profils créés sur l&apos;appli mais pas encore inscrits à cette séance.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {addableParticipants.map((participant) => (
                      <li
                        key={participant.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2"
                      >
                        <span>
                          {participant.firstName} {participant.lastName}
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary text-xs"
                          onClick={() => addParticipantToSession(participant.id)}
                        >
                          Inscrire et marquer présent
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
        ) : null}
      </section>

      {isSuperAdmin ? (
      <section className="card p-6">
        <h2 className="text-xl font-bold">Adhérents à jour (adhésion payée)</h2>
        <p className="muted mt-2 text-sm">
          Géré dans <Link href="/admin/facturation" className="font-semibold text-[var(--accent)]">Facturation & adhérents</Link>.
        </p>
        {paidMembers.length === 0 ? (
          <p className="mt-3 rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            Liste vide : les inscriptions publiques sont bloquées tant que Suzanne n&apos;a pas importé la liste.
          </p>
        ) : (
          <p className="muted mt-3 text-sm">{paidMembers.length} adhérent(s) importé(s).</p>
        )}
      </section>
      ) : null}

      {isSuperAdmin && stats ? (
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

      {isSuperAdmin ? (
      <details className="card p-6 group">
        <summary className="cursor-pointer list-none text-xl font-bold marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>Éditions mensuelles</span>
            <span className="text-sm font-normal text-[var(--accent)] group-open:hidden">Afficher ({seasonMonthKeys.length} mois)</span>
            <span className="hidden text-sm font-normal text-[var(--muted)] group-open:inline">Réduire</span>
          </span>
        </summary>
        <p className="muted mt-3 text-sm">
          Téléchargez un PDF listant, pour chaque séance du mois, les personnes inscrites (nom et prénom).
        </p>
        {seasonMonthKeys.length === 0 ? (
          <p className="muted mt-4 text-sm">Aucune séance disponible pour la saison active.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {seasonMonthKeys.map((monthKey) => {
              const { year, month } = parseMonthKey(monthKey);
              const label = formatMonthYear(year, month);
              const monthSessions = sessions.filter((session) => session.sessionDate.startsWith(monthKey));
              const isExporting = exportingMonth === monthKey;
              return (
                <li
                  key={monthKey}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-4 py-3"
                >
                  <div>
                    <p className="font-medium capitalize">{label}</p>
                    <p className="muted text-sm">
                      {monthSessions.length} séance{monthSessions.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={Boolean(exportingMonth)}
                    onClick={() => downloadMonthPdf(monthKey)}
                  >
                    {isExporting ? "Génération…" : "Édition PDF"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </details>
      ) : null}
    </div>
  );
}
