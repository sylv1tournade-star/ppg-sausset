import type { Attendance, Participant, Registration, Season, Session } from "@/lib/types";

type SeasonRow = {
  id: string;
  label: string;
  start_year: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  is_active: boolean;
  created_at: string;
};

type SessionRow = {
  id: string;
  season_id: string;
  session_date: string;
  status: Session["status"];
  theme: string | null;
  notes: string | null;
  created_at: string;
};

type ParticipantRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  access_token: string;
  email_reminders_enabled?: boolean;
  created_at: string;
};

export function mapSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    label: row.label,
    startYear: row.start_year,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    location: row.location,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    seasonId: row.season_id,
    sessionDate: row.session_date,
    status: row.status,
    theme: row.theme,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function mapParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    accessToken: row.access_token,
    emailRemindersEnabled: row.email_reminders_enabled !== false,
    createdAt: row.created_at,
  };
}

export function participantDisplayName(participant: Pick<Participant, "firstName" | "lastName">) {
  return `${participant.firstName} ${participant.lastName}`.trim();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function countRegistrationsBySession(registrations: Registration[]) {
  const counts = new Map<string, number>();
  for (const registration of registrations) {
    counts.set(registration.sessionId, (counts.get(registration.sessionId) ?? 0) + 1);
  }
  return counts;
}

export function groupRegistrationsByParticipant(registrations: Registration[]) {
  const map = new Map<string, string[]>();
  for (const registration of registrations) {
    const list = map.get(registration.participantId) ?? [];
    list.push(registration.sessionId);
    map.set(registration.participantId, list);
  }
  return map;
}

export function computeRanking(input: {
  participants: Participant[];
  registrations: Registration[];
  attendance: Attendance[];
  pastSessionIds: Set<string>;
  minSessions?: number;
}) {
  const minSessions = input.minSessions ?? 3;
  const registeredByParticipant = new Map<string, number>();
  const presentByParticipant = new Map<string, number>();

  for (const registration of input.registrations) {
    if (!input.pastSessionIds.has(registration.sessionId)) {
      continue;
    }
    registeredByParticipant.set(
      registration.participantId,
      (registeredByParticipant.get(registration.participantId) ?? 0) + 1,
    );
  }

  for (const record of input.attendance) {
    if (!input.pastSessionIds.has(record.sessionId) || record.status !== "present") {
      continue;
    }
    presentByParticipant.set(
      record.participantId,
      (presentByParticipant.get(record.participantId) ?? 0) + 1,
    );
  }

  return input.participants
    .map((participant) => {
      const registeredCount = registeredByParticipant.get(participant.id) ?? 0;
      const presentCount = presentByParticipant.get(participant.id) ?? 0;
      const rate = registeredCount > 0 ? Math.round((presentCount / registeredCount) * 100) : 0;
      return {
        participantId: participant.id,
        firstName: participant.firstName,
        lastName: participant.lastName,
        presentCount,
        registeredCount,
        rate,
      };
    })
    .filter((entry) => entry.registeredCount >= minSessions)
    .sort((a, b) => {
      if (b.presentCount !== a.presentCount) {
        return b.presentCount - a.presentCount;
      }
      return b.rate - a.rate;
    });
}
