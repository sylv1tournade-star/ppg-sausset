import {
  getThursdayDatesForSeason,
  isSessionPast,
  seasonLabelFromStartYear,
} from "@/lib/calendar";
import {
  computeRanking,
  mapParticipant,
  mapSeason,
  mapSession,
  normalizeEmail,
  participantDisplayName,
} from "@/lib/helpers";
import { matchesPaidMember, parsePaidMembersImport } from "@/lib/members";
import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  Attendance,
  BureauStats,
  PaidMember,
  Participant,
  RankingEntry,
  Registration,
  Season,
  Session,
  SessionWithMeta,
} from "@/lib/types";

export async function getActiveSeason(): Promise<Season | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_seasons")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapSeason(data) : null;
}

export async function getSeasonById(seasonId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("ppg_seasons").select("*").eq("id", seasonId).maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapSeason(data) : null;
}

export async function listSeasons() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_seasons")
    .select("*")
    .order("start_year", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapSeason);
}

export async function getSessionsForSeason(seasonId: string): Promise<Session[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_sessions")
    .select("*")
    .eq("season_id", seasonId)
    .order("session_date", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapSession);
}

export async function getParticipantByToken(token: string): Promise<Participant | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_participants")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapParticipant(data) : null;
}

export async function getParticipantByEmail(email: string): Promise<Participant | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_participants")
    .select("*")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapParticipant(data) : null;
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("ppg_participants").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapParticipant(data) : null;
}

export async function listParticipants() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_participants")
    .select("*")
    .order("last_name", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapParticipant);
}

export async function getRegistrationsForSeason(seasonId: string): Promise<Registration[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_registrations")
    .select("id, session_id, participant_id, created_at, ppg_sessions!inner(season_id)")
    .eq("ppg_sessions.season_id", seasonId);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    participantId: row.participant_id,
    createdAt: row.created_at,
  }));
}

export async function getRegistrationsForParticipant(participantId: string): Promise<Registration[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_registrations")
    .select("*")
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    participantId: row.participant_id,
    createdAt: row.created_at,
  }));
}

export async function getAttendanceForSeason(seasonId: string): Promise<Attendance[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_attendance")
    .select("id, session_id, participant_id, status, marked_at, ppg_sessions!inner(season_id)")
    .eq("ppg_sessions.season_id", seasonId);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    participantId: row.participant_id,
    status: row.status,
    markedAt: row.marked_at,
  }));
}

export async function getSessionParticipants(sessionId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_registrations")
    .select("participant_id, ppg_participants(id, first_name, last_name)")
    .eq("session_id", sessionId);
  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => {
      const participant = row.ppg_participants as
        | { id: string; first_name: string; last_name: string }
        | { id: string; first_name: string; last_name: string }[]
        | null;
      const value = Array.isArray(participant) ? participant[0] : participant;
      if (!value) {
        return null;
      }
      return {
        id: value.id,
        firstName: value.first_name,
        lastName: value.last_name,
      };
    })
    .filter((value): value is { id: string; firstName: string; lastName: string } => value !== null)
    .sort((a, b) => a.firstName.localeCompare(b.firstName, "fr"));
}

export async function enrichSessions(
  sessions: Session[],
  season: Season,
  participantId?: string | null,
): Promise<SessionWithMeta[]> {
  const supabase = getSupabaseAdmin();
  const sessionIds = sessions.map((session) => session.id);
  if (sessionIds.length === 0) {
    return [];
  }

  const { data: registrations, error } = await supabase
    .from("ppg_registrations")
    .select("session_id, participant_id, ppg_participants(id, first_name, last_name)")
    .in("session_id", sessionIds);
  if (error) {
    throw error;
  }

  const counts = new Map<string, number>();
  const mine = new Set<string>();
  const participantsBySession = new Map<string, { id: string; firstName: string; lastName: string }[]>();

  for (const row of registrations ?? []) {
    counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
    if (participantId && row.participant_id === participantId) {
      mine.add(row.session_id);
    }

    const raw = row.ppg_participants as
      | { id: string; first_name: string; last_name: string }
      | { id: string; first_name: string; last_name: string }[]
      | null;
    const participant = Array.isArray(raw) ? raw[0] : raw;
    if (!participant) {
      continue;
    }
    const list = participantsBySession.get(row.session_id) ?? [];
    list.push({
      id: participant.id,
      firstName: participant.first_name,
      lastName: participant.last_name,
    });
    participantsBySession.set(row.session_id, list);
  }

  for (const [sessionId, list] of participantsBySession) {
    list.sort((a, b) => a.firstName.localeCompare(b.firstName, "fr"));
    participantsBySession.set(sessionId, list);
  }

  return sessions.map((session) => ({
    ...session,
    registrationCount: counts.get(session.id) ?? 0,
    isRegistered: participantId ? mine.has(session.id) : undefined,
    participants: participantsBySession.get(session.id) ?? [],
  }));
}

export async function createSeason(input: {
  startYear: number;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  location?: string;
  activate?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const label = seasonLabelFromStartYear(input.startYear);
  const dayOfWeek = input.dayOfWeek ?? 4;
  const startTime = input.startTime ?? "19:00";
  const endTime = input.endTime ?? "20:00";
  const location = input.location ?? "Sausset-les-Pins";

  if (input.activate !== false) {
    await supabase.from("ppg_seasons").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: season, error } = await supabase
    .from("ppg_seasons")
    .insert({
      label,
      start_year: input.startYear,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      location,
      is_active: input.activate !== false,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const dates = getThursdayDatesForSeason(input.startYear, dayOfWeek);
  const rows = dates.map((sessionDate) => ({
    season_id: season.id,
    session_date: sessionDate,
    status: "scheduled",
  }));

  const { error: sessionError } = await supabase.from("ppg_sessions").insert(rows);
  if (sessionError) {
    throw sessionError;
  }

  return mapSeason(season);
}

export async function updateSession(
  sessionId: string,
  patch: Partial<Pick<Session, "status" | "theme" | "notes">>,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_sessions")
    .update({
      status: patch.status,
      theme: patch.theme,
      notes: patch.notes,
    })
    .eq("id", sessionId)
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return mapSession(data);
}

export async function createParticipant(input: {
  firstName: string;
  lastName: string;
  email: string;
  accessToken: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_participants")
    .insert({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      email: normalizeEmail(input.email),
      access_token: input.accessToken,
    })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return mapParticipant(data);
}

export async function registerParticipant(sessionId: string, participantId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("ppg_registrations").insert({
    session_id: sessionId,
    participant_id: participantId,
  });
  if (error) {
    throw error;
  }
}

export async function unregisterParticipant(sessionId: string, participantId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("ppg_registrations")
    .delete()
    .eq("session_id", sessionId)
    .eq("participant_id", participantId);
  if (error) {
    throw error;
  }
}

export async function markAttendance(
  sessionId: string,
  participantId: string,
  status: Attendance["status"],
) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("ppg_attendance").upsert(
    {
      session_id: sessionId,
      participant_id: participantId,
      status,
      marked_at: new Date().toISOString(),
    },
    { onConflict: "session_id,participant_id" },
  );
  if (error) {
    throw error;
  }
}

export async function getAttendanceForSession(sessionId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("ppg_attendance").select("*").eq("session_id", sessionId);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    participantId: row.participant_id,
    status: row.status,
    markedAt: row.marked_at,
  }));
}

export async function getRanking(limit = 10): Promise<RankingEntry[]> {
  const season = await getActiveSeason();
  if (!season) {
    return [];
  }

  const [sessions, participants, registrations, attendance] = await Promise.all([
    getSessionsForSeason(season.id),
    listParticipants(),
    getRegistrationsForSeason(season.id),
    getAttendanceForSeason(season.id),
  ]);

  const pastSessionIds = new Set(
    sessions
      .filter((session) => isSessionPast(session.sessionDate, season.endTime))
      .map((session) => session.id),
  );

  return computeRanking({
    participants,
    registrations,
    attendance,
    pastSessionIds,
    minSessions: 3,
  }).slice(0, limit);
}

export async function searchParticipants(query: string) {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) {
    return [];
  }

  const participants = await listParticipants();
  return participants
    .filter((participant) => {
      const full = participantDisplayName(participant).toLowerCase();
      return full.includes(trimmed) || participant.email.includes(trimmed);
    })
    .slice(0, 20);
}

export async function getBureauStats(): Promise<BureauStats> {
  const season = await getActiveSeason();
  if (!season) {
    return { sessions: [], months: [] };
  }

  const [sessions, registrations, attendance] = await Promise.all([
    getSessionsForSeason(season.id),
    getRegistrationsForSeason(season.id),
    getAttendanceForSeason(season.id),
  ]);

  const regsBySession = new Map<string, number>();
  for (const registration of registrations) {
    regsBySession.set(registration.sessionId, (regsBySession.get(registration.sessionId) ?? 0) + 1);
  }

  const attendanceBySession = new Map<string, { present: number; absent: number }>();
  for (const record of attendance) {
    const current = attendanceBySession.get(record.sessionId) ?? { present: 0, absent: 0 };
    if (record.status === "present") {
      current.present += 1;
    } else {
      current.absent += 1;
    }
    attendanceBySession.set(record.sessionId, current);
  }

  const sessionStats = sessions
    .filter((session) => isSessionPast(session.sessionDate, season.endTime))
    .map((session) => {
      const registered = regsBySession.get(session.id) ?? 0;
      const att = attendanceBySession.get(session.id) ?? { present: 0, absent: 0 };
      return {
        id: session.id,
        sessionDate: session.sessionDate,
        registered,
        present: att.present,
        absent: att.absent,
        fillRate: registered,
        attendanceRate: registered > 0 ? Math.round((att.present / registered) * 100) : 0,
      };
    });

  const monthMap = new Map<string, { absences: number; sessions: number }>();
  for (const stat of sessionStats) {
    const month = stat.sessionDate.slice(0, 7);
    const current = monthMap.get(month) ?? { absences: 0, sessions: 0 };
    current.absences += stat.absent;
    current.sessions += 1;
    monthMap.set(month, current);
  }

  const months = [...monthMap.entries()]
    .map(([month, value]) => ({ month, ...value }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return { sessions: sessionStats, months };
}

export async function getParticipantSessions(participantId: string, seasonId?: string) {
  const season = seasonId ? await getSeasonById(seasonId) : await getActiveSeason();
  if (!season) {
    return { season: null, sessions: [] as SessionWithMeta[] };
  }

  const [sessions, registrations] = await Promise.all([
    getSessionsForSeason(season.id),
    getRegistrationsForParticipant(participantId),
  ]);

  const registeredIds = new Set(registrations.map((registration) => registration.sessionId));
  const enriched = await enrichSessions(sessions, season, participantId);

  return {
    season,
    sessions: enriched.filter((session) => registeredIds.has(session.id)),
  };
}

type PaidMemberRow = {
  id: string;
  season_id: string;
  first_name: string;
  last_name: string;
  normalized_key: string;
  imported_at: string;
};

function mapPaidMember(row: PaidMemberRow): PaidMember {
  return {
    id: row.id,
    seasonId: row.season_id,
    firstName: row.first_name,
    lastName: row.last_name,
    normalizedKey: row.normalized_key,
    importedAt: row.imported_at,
  };
}

export async function listPaidMembers(seasonId: string): Promise<PaidMember[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_paid_members")
    .select("*")
    .eq("season_id", seasonId)
    .order("last_name", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapPaidMember);
}

export async function countPaidMembers(seasonId: string) {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("ppg_paid_members")
    .select("*", { count: "exact", head: true })
    .eq("season_id", seasonId);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function isPaidMemberForActiveSeason(firstName: string, lastName: string) {
  const season = await getActiveSeason();
  if (!season) {
    return { allowed: false, reason: "NO_SEASON" as const };
  }

  const members = await listPaidMembers(season.id);
  if (members.length === 0) {
    return { allowed: true, reason: "EMPTY_LIST" as const, season };
  }

  const allowed = matchesPaidMember(firstName, lastName, members);
  return {
    allowed,
    reason: allowed ? ("MATCH" as const) : ("NOT_FOUND" as const),
    season,
  };
}

export async function importPaidMembers(seasonId: string, raw: string, mode: "replace" | "merge" = "replace") {
  const supabase = getSupabaseAdmin();
  const parsed = parsePaidMembersImport(raw);

  if (parsed.length === 0) {
    throw new Error("Aucune ligne valide trouvée dans l'import.");
  }

  if (mode === "replace") {
    const { error: deleteError } = await supabase.from("ppg_paid_members").delete().eq("season_id", seasonId);
    if (deleteError) {
      throw deleteError;
    }
  }

  const { error } = await supabase.from("ppg_paid_members").upsert(
    parsed.map((row) => ({
      season_id: seasonId,
      first_name: row.firstName,
      last_name: row.lastName,
      normalized_key: row.normalizedKey,
    })),
    { onConflict: "season_id,normalized_key" },
  );
  if (error) {
    throw error;
  }

  return {
    imported: parsed.length,
    total: await countPaidMembers(seasonId),
  };
}

export async function clearPaidMembers(seasonId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("ppg_paid_members").delete().eq("season_id", seasonId);
  if (error) {
    throw error;
  }
}

