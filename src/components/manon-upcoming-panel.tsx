"use client";

import Link from "next/link";
import { formatParisShortDate, formatTimeLabel } from "@/lib/calendar";

type Props = {
  sessionId: string;
  sessionDate: string;
  theme: string | null;
  registrationCount: number;
  participants: Array<{ firstName: string; lastName: string }>;
  startTime: string;
  endTime: string;
  location: string;
};

export function ManonUpcomingPanel({
  sessionId,
  sessionDate,
  theme,
  registrationCount,
  participants,
  startTime,
  endTime,
  location,
}: Props) {
  const timeLabel = `${formatTimeLabel(startTime)}-${formatTimeLabel(endTime)}`;

  return (
    <section className="card border-2 border-[var(--accent)]/35 bg-gradient-to-br from-[var(--accent-soft)] to-white p-5 sm:p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">Prochaine séance</p>
      <p className="mt-2 text-xl font-bold sm:text-2xl">{formatParisShortDate(sessionDate)}</p>
      <p className="muted mt-1 text-sm">
        {timeLabel} · {location}
        {theme?.trim() ? ` · ${theme.trim()}` : ""}
      </p>
      <p className="mt-4 text-sm">
        <strong>{registrationCount}</strong> inscrit{registrationCount > 1 ? "s" : ""} en ligne pour le moment
      </p>
      {participants.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {participants.map((participant) => (
            <li
              key={`${participant.firstName}-${participant.lastName}`}
              className="rounded-lg bg-white/80 px-3 py-2 text-sm font-medium"
            >
              {participant.firstName} {participant.lastName}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted mt-3 text-sm">Personne inscrit pour le moment.</p>
      )}
      <Link href={`/seance/${sessionId}`} className="btn btn-secondary mt-4 text-sm">
        Voir la fiche séance
      </Link>
    </section>
  );
}
