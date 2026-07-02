"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatDayOfWeekLongCapitalized,
  formatMonthYear,
  formatParisShortDate,
  getMonthGrid,
  getWeekdayLabels,
  getCurrentAgendaMonthKey,
  isSessionPast,
  isSessionRegisterable,
  parseMonthKey,
  pickAgendaMonthKey,
  pickDefaultSessionIdInMonth,
  shiftMonthKey,
} from "@/lib/calendar";
import { SessionDetail } from "@/components/session-detail";
import type { Season, SessionWithMeta } from "@/lib/types";

type Props = {
  season: Season;
  sessions: SessionWithMeta[];
  isLoggedIn: boolean;
  focusSessionId?: string | null;
};

function pickDefaultMonth(sessions: SessionWithMeta[]) {
  return pickAgendaMonthKey(sessions.map((session) => session.sessionDate));
}

function pickDefaultSession(sessions: SessionWithMeta[], monthKey: string) {
  return pickDefaultSessionIdInMonth(sessions, monthKey);
}

export function SessionCalendarView({
  season,
  sessions: initialSessions,
  isLoggedIn,
  focusSessionId = null,
}: Props) {
  const [sessions, setSessions] = useState(initialSessions);
  const [monthKey, setMonthKey] = useState(() => pickDefaultMonth(initialSessions));
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    pickDefaultSession(initialSessions, pickDefaultMonth(initialSessions)),
  );

  useEffect(() => {
    if (!focusSessionId) {
      return;
    }
    const session = sessions.find((item) => item.id === focusSessionId);
    if (!session) {
      return;
    }
    setMonthKey(session.sessionDate.slice(0, 7));
    setSelectedId(session.id);
  }, [focusSessionId, sessions]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionWithMeta>();
    for (const session of sessions) {
      map.set(session.sessionDate, session);
    }
    return map;
  }, [sessions]);

  const monthBounds = useMemo(() => {
    if (sessions.length === 0) {
      return { min: monthKey, max: monthKey };
    }
    const keys = sessions.map((session) => session.sessionDate.slice(0, 7)).sort();
    return { min: keys[0], max: keys[keys.length - 1] };
  }, [sessions, monthKey]);

  const { year, month } = parseMonthKey(monthKey);
  const grid = getMonthGrid(year, month);
  const thursdaysInMonth = sessions.filter((session) => session.sessionDate.startsWith(monthKey));
  const selected = sessions.find((session) => session.id === selectedId) ?? null;
  const sessionDayLabel = formatDayOfWeekLongCapitalized(season.dayOfWeek);

  function goToCurrentMonth() {
    const current = getCurrentAgendaMonthKey(sessions.map((session) => session.sessionDate));
    if (current < monthBounds.min || current > monthBounds.max) {
      return;
    }
    setMonthKey(current);
    const defaultId = pickDefaultSession(sessions, current);
    if (defaultId) {
      setSelectedId(defaultId);
    }
  }

  function goMonth(delta: number) {
    const next = shiftMonthKey(monthKey, delta);
    if (next < monthBounds.min || next > monthBounds.max) {
      return;
    }
    setMonthKey(next);
    const nextSessionId = pickDefaultSession(sessions, next);
    setSelectedId(nextSessionId);
  }

  function selectDate(date: string) {
    const session = sessionsByDate.get(date);
    if (!session) {
      return;
    }
    setSelectedId(session.id);
  }

  function handleSessionsUpdate(updated: SessionWithMeta[]) {
    setSessions(updated);
  }

  const canGoPrev = monthKey > monthBounds.min;
  const canGoNext = monthKey < monthBounds.max;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <section className="card p-4 sm:p-6">
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
          <div className="min-w-0 flex-1 text-center">
            <h2 className="text-lg font-bold capitalize">{formatMonthYear(year, month)}</h2>
            <button type="button" className="muted mt-1 text-xs underline" onClick={goToCurrentMonth}>
              Aujourd&apos;hui
            </button>
          </div>
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

        {thursdaysInMonth.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {thursdaysInMonth.map((session) => {
              const past = isSessionPast(session.sessionDate, season.endTime);
              const active = session.id === selectedId;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedId(session.id)}
                  className={
                    active
                      ? "rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white"
                      : "rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium"
                  }
                >
                  {formatParisShortDate(session.sessionDate)}
                  {isLoggedIn && session.isRegistered ? " · inscrit" : ""}
                  {session.status === "cancelled" ? " · annulée" : ""}
                  {session.status === "rescheduled" ? " · reportée" : ""}
                  {past && session.status !== "cancelled" && session.status !== "rescheduled" ? " · passée" : ""}
                  {session.registrationCount > 0 ? ` (${session.registrationCount})` : ""}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="muted mt-4 text-sm">Aucune séance PPG ce mois-ci.</p>
        )}

        <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[var(--muted)]">
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
            const isSelected = session?.id === selectedId;
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
                          : "bg-[var(--accent-soft)] text-[var(--accent)] hover:brightness-95",
                ].join(" ")}
              >
                <span>{cell.day}</span>
                {isLoggedIn && session.isRegistered && !isSelected ? (
                  <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide">✓</span>
                ) : null}
                {session.registrationCount > 0 ? (
                  <span className={`mt-0.5 text-[10px] font-bold ${isSelected ? "text-white/90" : ""}`}>
                    {session.registrationCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="muted mt-4 text-xs">
          Touchez un {sessionDayLabel.toLowerCase()} coloré pour voir la séance. Le chiffre indique le nombre d&apos;inscrits.
        </p>
      </section>

      <section className="lg:sticky lg:top-4 lg:self-start">
        {selected ? (
          <SessionDetail
            session={selected}
            season={season}
            isLoggedIn={isLoggedIn}
            onSessionsUpdate={handleSessionsUpdate}
          />
        ) : (
          <div className="card p-6">
            <p className="muted text-sm">Sélectionnez un jeudi dans le calendrier.</p>
          </div>
        )}
      </section>
    </div>
  );
}
