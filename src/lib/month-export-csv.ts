import { formatParisShortDate } from "@/lib/calendar";
import type { AttendanceStatus } from "@/lib/types";

type PresenceRow = {
  sessionDate: string;
  firstName: string;
  lastName: string;
  registeredOnline: boolean;
  attendanceStatus: AttendanceStatus | null;
};

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Présent",
  absent: "Absent",
  excused: "Excusé",
};

function escapeCsv(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildMonthPresenceCsv(input: { monthLabel: string; rows: PresenceRow[] }) {
  const lines = [
    ["Mois", input.monthLabel].map(escapeCsv).join(","),
    ["Date", "Prénom", "Nom", "Inscrit en ligne", "Présence saisie"].map(escapeCsv).join(","),
    ...input.rows.map((row) =>
      [
        formatParisShortDate(row.sessionDate),
        row.firstName,
        row.lastName,
        row.registeredOnline ? "Oui" : "Non",
        row.attendanceStatus ? ATTENDANCE_LABELS[row.attendanceStatus] : "—",
      ]
        .map(escapeCsv)
        .join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export function buildMonthRegistrationsCsv(input: {
  monthLabel: string;
  sessions: Array<{
    sessionDate: string;
    theme: string | null;
    status: string;
    participants: Array<{ firstName: string; lastName: string }>;
  }>;
}) {
  const lines = [
    ["Mois", input.monthLabel].map(escapeCsv).join(","),
    ["Date", "Statut", "Thème", "Prénom", "Nom"].map(escapeCsv).join(","),
  ];

  for (const session of input.sessions) {
    const statusLabel =
      session.status === "cancelled" ? "Annulée" : session.status === "rescheduled" ? "Reportée" : "Programmée";
    const theme = session.theme?.trim() ?? "";
    const date = formatParisShortDate(session.sessionDate);
    if (session.participants.length === 0) {
      lines.push([date, statusLabel, theme, "", ""].map(escapeCsv).join(","));
      continue;
    }
    for (const participant of session.participants) {
      lines.push(
        [date, statusLabel, theme, participant.firstName, participant.lastName].map(escapeCsv).join(","),
      );
    }
  }

  return `\uFEFF${lines.join("\r\n")}`;
}
