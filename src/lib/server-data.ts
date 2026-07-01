import {
  formatMonthYear,
  getThursdayDatesForSeason,
  isSessionPast,
  seasonLabelFromStartYear,
  toMonthKey,
} from "@/lib/calendar";
import {
  computeRanking,
  mapParticipant,
  mapSeason,
  mapSession,
  normalizeEmail,
  participantDisplayName,
} from "@/lib/helpers";
import { matchesPaidMember, memberKey, parsePaidMembersImport } from "@/lib/members";
import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  Attendance,
  BillingSessionRow,
  BillingSessionSnapshot,
  BureauStats,
  MonthBillingPreview,
  MonthValidation,
  PaidMember,
  Participant,
  RankingEntry,
  Registration,
  Season,
  Session,
  SessionWithMeta,
  TreasurerEmail,
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
      return full.includes(trimmed);
    })
    .slice(0, 20)
    .map((participant) => ({
      id: participant.id,
      firstName: participant.firstName,
      lastName: participant.lastName,
    }));
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

export async function getParticipantAssiduity(participantId: string) {
  const season = await getActiveSeason();
  if (!season) {
    return null;
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

  const ranking = computeRanking({
    participants,
    registrations,
    attendance,
    pastSessionIds,
    minSessions: 0,
  });

  return ranking.find((entry) => entry.participantId === participantId) ?? null;
}

export async function getAddableParticipantsForSession(sessionId: string) {
  const season = await getActiveSeason();
  if (!season) {
    return [];
  }

  const [paidMembers, registered, participants] = await Promise.all([
    listPaidMembers(season.id),
    getSessionParticipants(sessionId),
    listParticipants(),
  ]);

  const registeredIds = new Set(registered.map((participant) => participant.id));
  const paidKeys = new Set(paidMembers.map((member) => member.normalizedKey));

  return participants
    .filter((participant) => {
      if (registeredIds.has(participant.id)) {
        return false;
      }
      const key = memberKey(participant.firstName, participant.lastName);
      return paidKeys.has(key);
    })
    .sort((a, b) => a.firstName.localeCompare(b.firstName, "fr"));
}

export async function markAllAttendance(
  sessionId: string,
  participantIds: string[],
  status: Attendance["status"],
) {
  for (const participantId of participantIds) {
    await markAttendance(sessionId, participantId, status);
  }
}

export async function registerAndMarkAttendance(
  sessionId: string,
  participantId: string,
  status: Attendance["status"] = "present",
) {
  await registerParticipant(sessionId, participantId);
  await markAttendance(sessionId, participantId, status);
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
    return { allowed: false, reason: "EMPTY_LIST" as const, season };
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

export async function getMonthRegistrationsReport(year: number, monthIndex: number) {
  const season = await getActiveSeason();
  if (!season) {
    throw new Error("NO_SEASON");
  }

  const monthKey = toMonthKey(year, monthIndex);
  const sessions = (await getSessionsForSeason(season.id)).filter((session) =>
    session.sessionDate.startsWith(monthKey),
  );
  const enriched = await enrichSessions(sessions, season);

  return {
    season,
    monthLabel: formatMonthYear(year, monthIndex),
    year,
    month: monthIndex,
    sessions: enriched,
  };
}

type TreasurerEmailRow = {
  id: string;
  email: string;
  label: string | null;
  created_at: string;
};

type MonthValidationRow = {
  id: string;
  season_id: string;
  year: number;
  month: number;
  computed_session_count: number;
  billed_session_count: number;
  billing_note: string | null;
  session_snapshot: BillingSessionSnapshot[];
  last_sent_at: string | null;
  send_count: number;
  created_at: string;
  updated_at: string;
};

function mapTreasurerEmail(row: TreasurerEmailRow): TreasurerEmail {
  return {
    id: row.id,
    email: row.email,
    label: row.label,
    createdAt: row.created_at,
  };
}

function mapMonthValidation(row: MonthValidationRow): MonthValidation {
  return {
    id: row.id,
    seasonId: row.season_id,
    year: row.year,
    month: row.month,
    computedSessionCount: row.computed_session_count,
    billedSessionCount: row.billed_session_count,
    billingNote: row.billing_note,
    sessionSnapshot: row.session_snapshot ?? [],
    lastSentAt: row.last_sent_at,
    sendCount: row.send_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTreasurerEmails(): Promise<TreasurerEmail[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_treasurer_emails")
    .select("*")
    .order("email", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => mapTreasurerEmail(row as TreasurerEmailRow));
}

export async function addTreasurerEmail(email: string, label?: string | null) {
  const supabase = getSupabaseAdmin();
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("INVALID_EMAIL");
  }
  const { data, error } = await supabase
    .from("ppg_treasurer_emails")
    .insert({ email: normalized, label: label?.trim() || null })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return mapTreasurerEmail(data as TreasurerEmailRow);
}

export async function removeTreasurerEmail(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("ppg_treasurer_emails").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function getMonthValidation(seasonId: string, year: number, month: number) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_month_validations")
    .select("*")
    .eq("season_id", seasonId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapMonthValidation(data as MonthValidationRow) : null;
}

export async function listMonthValidations(seasonId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_month_validations")
    .select("*")
    .eq("season_id", seasonId)
    .order("year", { ascending: true })
    .order("month", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => mapMonthValidation(row as MonthValidationRow));
}

async function buildBillingSessionRow(
  session: Session,
  season: Season,
): Promise<BillingSessionRow> {
  const [registered, attendance] = await Promise.all([
    getSessionParticipants(session.id),
    getAttendanceForSession(session.id),
  ]);

  const attendanceByParticipant = new Map(attendance.map((record) => [record.participantId, record]));
  const issues: string[] = [];
  const past = isSessionPast(session.sessionDate, season.endTime);
  const presentParticipants = registered
    .filter((participant) => attendanceByParticipant.get(participant.id)?.status === "present")
    .map((participant) => ({
      firstName: participant.firstName,
      lastName: participant.lastName,
    }));

  let attendanceComplete = true;
  if (past && session.status === "scheduled" && registered.length > 0) {
    for (const participant of registered) {
      if (!attendanceByParticipant.has(participant.id)) {
        attendanceComplete = false;
        issues.push(`Présence non renseignée pour ${participant.firstName} ${participant.lastName}`);
      }
    }
  }

  if (past && session.status === "scheduled" && registered.length > 0 && !attendanceComplete) {
    issues.push("Feuille de présence incomplète");
  }

  const isRealized =
    past && session.status === "scheduled" && attendanceComplete && presentParticipants.length >= 1;

  return {
    id: session.id,
    sessionDate: session.sessionDate,
    theme: session.theme,
    status: session.status,
    registeredCount: registered.length,
    presentCount: presentParticipants.length,
    attendanceComplete,
    isRealized,
    presentParticipants,
    issues,
  };
}

export async function getMonthBillingPreview(year: number, monthIndex: number): Promise<MonthBillingPreview> {
  const season = await getActiveSeason();
  if (!season) {
    throw new Error("NO_SEASON");
  }

  const monthKey = toMonthKey(year, monthIndex);
  const sessions = (await getSessionsForSeason(season.id)).filter((session) =>
    session.sessionDate.startsWith(monthKey),
  );

  const rows = await Promise.all(sessions.map((session) => buildBillingSessionRow(session, season)));
  const realizedSessions: BillingSessionSnapshot[] = rows
    .filter((row) => row.isRealized)
    .map((row) => ({
      id: row.id,
      sessionDate: row.sessionDate,
      theme: row.theme,
      presentCount: row.presentCount,
      presentParticipants: row.presentParticipants,
    }));

  const blockingIssues = rows.flatMap((row) => {
    if (!isSessionPast(row.sessionDate, season.endTime)) {
      return [];
    }
    if (row.status !== "scheduled") {
      return [];
    }
    if (row.registeredCount === 0) {
      return [];
    }
    if (!row.attendanceComplete) {
      return [`${row.sessionDate} : présences incomplètes`];
    }
    return [];
  });

  const lastValidation = await getMonthValidation(season.id, year, monthIndex + 1);

  return {
    season,
    monthLabel: formatMonthYear(year, monthIndex),
    year,
    month: monthIndex,
    sessions: rows,
    realizedSessions,
    computedSessionCount: realizedSessions.length,
    blockingIssues,
    canValidate: blockingIssues.length === 0,
    lastValidation,
  };
}

export async function saveAndSendMonthValidation(input: {
  year: number;
  monthIndex: number;
  billedSessionCount: number;
  billingNote?: string | null;
  sendEmail: boolean;
}) {
  const preview = await getMonthBillingPreview(input.year, input.monthIndex);
  if (!preview.canValidate) {
    throw new Error("BLOCKING_ISSUES");
  }

  if (input.billedSessionCount < 0 || !Number.isFinite(input.billedSessionCount)) {
    throw new Error("INVALID_BILLED_COUNT");
  }

  const month = input.monthIndex + 1;
  const existing = await getMonthValidation(preview.season.id, input.year, month);
  const isResend = Boolean(existing?.lastSentAt);

  const supabase = getSupabaseAdmin();
  const payload = {
    season_id: preview.season.id,
    year: input.year,
    month,
    computed_session_count: preview.computedSessionCount,
    billed_session_count: input.billedSessionCount,
    billing_note: input.billingNote?.trim() || null,
    session_snapshot: preview.realizedSessions,
    updated_at: new Date().toISOString(),
  };

  let validation: MonthValidation;
  if (existing) {
    const { data, error } = await supabase
      .from("ppg_month_validations")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) {
      throw error;
    }
    validation = mapMonthValidation(data as MonthValidationRow);
  } else {
    const { data, error } = await supabase
      .from("ppg_month_validations")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      throw error;
    }
    validation = mapMonthValidation(data as MonthValidationRow);
  }

  if (input.sendEmail) {
    const treasurers = await listTreasurerEmails();
    if (treasurers.length === 0) {
      throw new Error("NO_TREASURERS");
    }

    const { buildBillingValidationPdf } = await import("@/lib/billing-export-pdf");
    const { sendBillingValidationEmail } = await import("@/lib/email");

    const pdfBytes = await buildBillingValidationPdf({
      season: preview.season,
      monthLabel: preview.monthLabel,
      computedSessionCount: preview.computedSessionCount,
      billedSessionCount: input.billedSessionCount,
      billingNote: input.billingNote?.trim() || null,
      realizedSessions: preview.realizedSessions,
    });

    const filename = `ppg-facturation-${input.year}-${String(month).padStart(2, "0")}.pdf`;
    await sendBillingValidationEmail({
      to: treasurers.map((item) => item.email),
      monthLabel: preview.monthLabel,
      billedSessionCount: input.billedSessionCount,
      computedSessionCount: preview.computedSessionCount,
      billingNote: input.billingNote?.trim() || null,
      pdfBytes,
      filename,
      isResend,
    });

    const { data, error } = await supabase
      .from("ppg_month_validations")
      .update({
        last_sent_at: new Date().toISOString(),
        send_count: (existing?.sendCount ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validation.id)
      .select("*")
      .single();
    if (error) {
      throw error;
    }
    validation = mapMonthValidation(data as MonthValidationRow);
  }

  return { preview, validation, isResend };
}

