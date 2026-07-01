"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatDayOfWeekLongCapitalized,
  formatMonthYear,
  formatParisShortDate,
  getMonthGrid,
  getWeekdayLabels,
  isSessionPast,
  parseMonthKey,
  pickAgendaMonthKey,
  pickDefaultSessionIdInMonth,
  shiftMonthKey,
} from "@/lib/calendar";
import type { Season, Session } from "@/lib/types";

type Props = {
  season: Season;
  sessions: Session[];
  isSuperAdmin: boolean;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onUpdateSession: (sessionId: string, patch: Partial<Session>) => void;
  onOpenAttendance?: (sessionId: string) => void;
};

function SessionEditPanel({
  session,
  isSuperAdmin,
  onUpdateSession,
  onOpenAttendance,
}: {
  session: Session;
  isSuperAdmin: boolean;
  onUpdateSession: (sessionId: string, patch: Partial<Session>) => void;
  onOpenAttendance?: (sessionId: string) => void;
}) {
  const [theme, setTheme] = useState(session.theme ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");

  useEffect(() => {
    setTheme(session.theme ?? "");
    setNotes(session.notes ?? "");
  }, [session.id, session.theme, session.notes]);

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{formatParisShortDate(session.sessionDate)}</p>
        <select
          className="input max-w-[10rem]"
          value={session.status}
          onChange={(e) =>
            onUpdateSession(session.id, {
              status: e.target.value as Session["status"],
            })
          }
        >
          <option value="scheduled">Programmée</option>
          <option value="cancelled">Annulée</option>
          <option value="rescheduled">Reportée</option>
        </select>
      </div>
      <label className="mt-3 block space-y-1">
        <span className="text-xs font-medium">Thème de la séance</span>
        <input
          className="input"
          placeholder="Ex. : reprise, gainage…"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          onBlur={() => {
            if (theme !== (session.theme ?? "")) {
              onUpdateSession(session.id, { theme });
            }
          }}
        />
      </label>
      <label className="mt-3 block space-y-1">
        <span className="text-xs font-medium">Notes / consignes</span>
        <textarea
          className="input min-h-24"
          placeholder="Consignes pour les adhérents…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (session.notes ?? "")) {
              onUpdateSession(session.id, { notes });
            }
          }}
        />
      </label>
      {isSuperAdmin && onOpenAttendance ? (
        <button type="button" className="btn btn-secondary mt-3" onClick={() => onOpenAttendance(session.id)}>
          Feuille de présence
        </button>
      ) : null}
    </article>
  );
}

export function AdminSessionAgenda({
  season,
  sessions,
  isSuperAdmin,
  selectedSessionId,
  onSelectSession,
  onUpdateSession,
  onOpenAttendance,
}: Props) {
  const sessionDates = useMemo(() => sessions.map((session) => session.sessionDate), [sessions]);
  const [monthKey, setMonthKey] = useState(() => pickAgendaMonthKey(sessionDates));

  useEffect(() => {
    setMonthKey(pickAgendaMonthKey(sessionDates));
  }, [season.id, sessionDates.length]);

  const monthBounds = useMemo(() => {
    if (sessionDates.length === 0) {
      return { min: monthKey, max: monthKey };
    }
    const keys = sessionDates.map((date) => date.slice(0, 7)).sort();
    return { min: keys[0], max: keys[keys.length - 1] };
  }, [sessionDates, monthKey]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session>();
    for (const session of sessions) {
      map.set(session.sessionDate, session);
    }
    return map;
  }, [sessions]);

  const { year, month } = parseMonthKey(monthKey);
  const grid = getMonthGrid(year, month);
  const sessionsInMonth = sessions.filter((session) => session.sessionDate.startsWith(monthKey));
  const selected =
    sessions.find((session) => session.id === selectedSessionId) ??
    sessions.find((session) => session.id === pickDefaultSessionIdInMonth(sessions, monthKey)) ??
    null;

  useEffect(() => {
    if (selectedSessionId) {
      return;
    }
    const defaultId = pickDefaultSessionIdInMonth(sessions, monthKey);
    if (defaultId) {
      onSelectSession(defaultId);
    }
  }, [monthKey, onSelectSession, selectedSessionId, sessions]);

  function goMonth(delta: number) {
    const next = shiftMonthKey(monthKey, delta);
    if (next < monthBounds.min || next > monthBounds.max) {
      return;
    }
    setMonthKey(next);
    const defaultId = pickDefaultSessionIdInMonth(sessions, next);
    if (defaultId) {
      onSelectSession(defaultId);
    }
  }

  function selectDate(date: string) {
    const session = sessionsByDate.get(date);
    if (session) {
      onSelectSession(session.id);
    }
  }

  const canGoPrev = monthKey > monthBounds.min;
  const canGoNext = monthKey < monthBounds.max;
  const dayLabel = formatDayOfWeekLongCapitalized(season.dayOfWeek);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
      <div>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="btn btn-secondary px-3"
            onClick={() => goMonth(-1)}
            disabled={!canGoPrev}
            aria-label="Mois précédent"
          >
            ←
          </button>
          <h3 className="text-center text-lg font-bold capitalize">{formatMonthYear(year, month)}</h3>
          <button
            type="button"
            className="btn btn-secondary px-3"
            onClick={() => goMonth(1)}
            disabled={!canGoNext}
            aria-label="Mois suivant"
          >
            →
          </button>
        </div>

        {sessionsInMonth.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {sessionsInMonth.map((session) => {
              const active = session.id === selected?.id;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  className={
                    active
                      ? "rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white"
                      : "rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium"
                  }
                >
                  {formatParisShortDate(session.sessionDate)}
                  {session.status === "cancelled" ? " · annulée" : ""}
                  {session.status === "rescheduled" ? " · reportée" : ""}
                  {session.theme?.trim() ? ` · ${session.theme.trim()}` : ""}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="muted mt-3 text-sm">Aucune séance ce mois-ci.</p>
        )}

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[var(--muted)]">
          {getWeekdayLabels().map((label) => (
            <div key={label} className="py-1">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, index) => {
            if (!cell.date || cell.day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const session = sessionsByDate.get(cell.date);
            const isSessionDay = new Date(`${cell.date}T12:00:00`).getDay() === season.dayOfWeek;
            const isSelected = session?.id === selected?.id;
            const past = session ? isSessionPast(session.sessionDate, season.endTime) : false;

            if (!session || !isSessionDay) {
              return (
                <div
                  key={cell.date}
                  className="flex aspect-square items-center justify-center rounded-lg text-sm text-[var(--muted)] opacity-50"
                >
                  {cell.day}
                </div>
              );
            }

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => selectDate(cell.date!)}
                className={[
                  "relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-semibold transition",
                  isSelected
                    ? "bg-[var(--accent)] text-white shadow-md"
                    : session.status === "cancelled"
                      ? "bg-[#f8d7da] text-[var(--danger)]"
                      : session.status === "rescheduled"
                        ? "bg-[#ffe8cc] text-[#9a5b13]"
                        : past
                          ? "bg-[#fff3cd] text-[#856404]"
                          : session.notes?.trim() || session.theme?.trim()
                            ? "bg-[var(--accent)]/20 text-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                            : "bg-[var(--accent-soft)] text-[var(--accent)] hover:brightness-95",
                ].join(" ")}
                title={session.theme ?? session.notes ?? undefined}
              >
                <span>{cell.day}</span>
                {session.theme?.trim() ? (
                  <span className={`mt-0.5 line-clamp-1 px-0.5 text-[9px] font-normal ${isSelected ? "text-white/90" : ""}`}>
                    ●
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="muted mt-3 text-xs">
          Agenda ouvert sur le mois en cours. Touchez un {dayLabel} coloré pour modifier thème et consignes.
        </p>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        {selected ? (
          <SessionEditPanel
            session={selected}
            isSuperAdmin={isSuperAdmin}
            onUpdateSession={onUpdateSession}
            onOpenAttendance={onOpenAttendance}
          />
        ) : (
          <p className="muted rounded-xl border border-dashed border-[var(--border)] p-4 text-sm">
            Sélectionnez une séance dans le calendrier.
          </p>
        )}
      </div>
    </div>
  );
}
