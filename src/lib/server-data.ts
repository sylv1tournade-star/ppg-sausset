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
  BillingAccountingStatus,
  BillingRecipientType,
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
import { billableSnapshotsFromRows, countBillableSessions, suggestAccountingStatus } from "@/lib/billing";

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

type BillingEmailRow = {
  id: string;
  email: string;
  label: string | null;
  recipient_type: BillingRecipientType;
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

function mapBillingEmail(row: BillingEmailRow): TreasurerEmail {
  return {
    id: row.id,
    email: row.email,
    label: row.label,
    recipientType: row.recipient_type,
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

export async function listBillingRecipients(type?: BillingRecipientType): Promise<TreasurerEmail[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("ppg_treasurer_emails").select("*").order("email", { ascending: true });
  if (type) {
    query = query.eq("recipient_type", type);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => mapBillingEmail(row as BillingEmailRow));
}

export async function listTreasurerEmails() {
  return listBillingRecipients("treasurer");
}

export async function addBillingRecipient(
  email: string,
  recipientType: BillingRecipientType,
  label?: string | null,
) {
  const supabase = getSupabaseAdmin();
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("INVALID_EMAIL");
  }
  const { data, error } = await supabase
    .from("ppg_treasurer_emails")
    .insert({
      email: normalized,
      label: label?.trim() || null,
      recipient_type: recipientType,
    })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return mapBillingEmail(data as BillingEmailRow);
}

export async function addTreasurerEmail(email: string, label?: string | null) {
  return addBillingRecipient(email, "treasurer", label);
}

export async function removeBillingRecipient(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("ppg_treasurer_emails").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function removeTreasurerEmail(id: string) {
  return removeBillingRecipient(id);
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
  const past = isSessionPast(session.sessionDate, season.endTime);
  const presentParticipants = registered
    .filter((participant) => attendanceByParticipant.get(participant.id)?.status === "present")
    .map((participant) => ({
      firstName: participant.firstName,
      lastName: participant.lastName,
    }));
  const registeredParticipants = registered.map((participant) => ({
    firstName: participant.firstName,
    lastName: participant.lastName,
  }));

  const suggestedAccountingStatus = suggestAccountingStatus({
    sessionDate: session.sessionDate,
    status: session.status,
    past,
    presentCount: presentParticipants.length,
    registeredCount: registered.length,
  });

  return {
    id: session.id,
    sessionDate: session.sessionDate,
    theme: session.theme,
    status: session.status,
    registeredCount: registered.length,
    presentCount: presentParticipants.length,
    attendanceMarkedCount: attendance.length,
    suggestedAccountingStatus,
    presentParticipants,
    registeredParticipants,
  };
}

function accountingStatusFromSnapshot(snapshot: BillingSessionSnapshot): BillingAccountingStatus {
  return snapshot.accountingStatus ?? (snapshot.presentCount >= 1 ? "realized" : "not_held");
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
  const lastValidation = await getMonthValidation(season.id, year, monthIndex + 1);

  const statusBySessionId = new Map<string, BillingAccountingStatus>();
  if (lastValidation) {
    for (const snapshot of lastValidation.sessionSnapshot) {
      statusBySessionId.set(snapshot.id, accountingStatusFromSnapshot(snapshot));
    }
  }

  const suggestedBillableCount = countBillableSessions(
    rows.map((row) => statusBySessionId.get(row.id) ?? row.suggestedAccountingStatus),
  );

  const hasFutureSessions = rows.some((row) => row.suggestedAccountingStatus === "future");

  return {
    season,
    monthLabel: formatMonthYear(year, monthIndex),
    year,
    month: monthIndex,
    sessions: rows,
    suggestedBillableCount,
    canValidate: !hasFutureSessions,
    lastValidation,
  };
}

export async function saveAndSendMonthValidation(input: {
  year: number;
  monthIndex: number;
  billedSessionCount: number;
  billingNote?: string | null;
  sessionStatuses: Array<{ sessionId: string; accountingStatus: BillingAccountingStatus }>;
  sendEmail: boolean;
}) {
  const preview = await getMonthBillingPreview(input.year, input.monthIndex);
  if (!preview.canValidate) {
    throw new Error("FUTURE_SESSIONS");
  }

  if (input.billedSessionCount < 0 || !Number.isFinite(input.billedSessionCount)) {
    throw new Error("INVALID_BILLED_COUNT");
  }

  const statusBySessionId = Object.fromEntries(
    input.sessionStatuses.map((item) => [item.sessionId, item.accountingStatus]),
  ) as Record<string, BillingAccountingStatus>;

  const allSnapshots = preview.sessions.map((row) => {
    const accountingStatus = statusBySessionId[row.id] ?? row.suggestedAccountingStatus;
    return {
      id: row.id,
      sessionDate: row.sessionDate,
      theme: row.theme,
      registeredCount: row.registeredCount,
      presentCount: row.presentCount,
      accountingStatus,
      presentParticipants: row.presentParticipants,
    };
  });

  const billableSnapshots = billableSnapshotsFromRows(preview.sessions, statusBySessionId);
  const computedSessionCount = countBillableSessions(
    preview.sessions.map((row) => statusBySessionId[row.id] ?? row.suggestedAccountingStatus),
  );

  const month = input.monthIndex + 1;
  const existing = await getMonthValidation(preview.season.id, input.year, month);
  const isResend = Boolean(existing?.lastSentAt);

  const supabase = getSupabaseAdmin();
  const payload = {
    season_id: preview.season.id,
    year: input.year,
    month,
    computed_session_count: computedSessionCount,
    billed_session_count: input.billedSessionCount,
    billing_note: input.billingNote?.trim() || null,
    session_snapshot: allSnapshots,
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
    const recipients = await listBillingRecipients();
    const to = recipients.filter((item) => item.recipientType === "treasurer").map((item) => item.email);
    const cc = recipients
      .filter((item) => item.recipientType === "coach" || item.recipientType === "billing_manager")
      .map((item) => item.email);

    if (to.length === 0) {
      throw new Error("NO_TREASURERS");
    }

    const { buildBillingValidationPdf } = await import("@/lib/billing-export-pdf");
    const { sendBillingValidationEmail } = await import("@/lib/email");

    const pdfBytes = await buildBillingValidationPdf({
      season: preview.season,
      monthLabel: preview.monthLabel,
      computedSessionCount,
      billedSessionCount: input.billedSessionCount,
      billingNote: input.billingNote?.trim() || null,
      realizedSessions: billableSnapshots,
      allSessions: allSnapshots,
    });

    const filename = `ppg-facturation-${input.year}-${String(month).padStart(2, "0")}.pdf`;
    await sendBillingValidationEmail({
      to,
      cc,
      monthLabel: preview.monthLabel,
      billedSessionCount: input.billedSessionCount,
      computedSessionCount,
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

  return { preview, validation, isResend, billableSnapshots, allSnapshots };
}

export async function getLastSessionOfMonth(seasonId: string, year: number, monthIndex: number) {
  const monthKey = toMonthKey(year, monthIndex);
  const sessions = (await getSessionsForSeason(seasonId))
    .filter((session) => session.sessionDate.startsWith(monthKey))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  return sessions[sessions.length - 1] ?? null;
}

export async function wasMonthReminderSent(seasonId: string, year: number, month: number) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ppg_month_reminders")
    .select("id")
    .eq("season_id", seasonId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return Boolean(data);
}

export async function markMonthReminderSent(seasonId: string, year: number, month: number) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("ppg_month_reminders").upsert(
    {
      season_id: seasonId,
      year,
      month,
      sent_at: new Date().toISOString(),
    },
    { onConflict: "season_id,year,month" },
  );
  if (error) {
    throw error;
  }
}

export async function maybeSendMonthValidationReminder() {
  const season = await getActiveSeason();
  if (!season || !process.env.BREVO_API_KEY) {
    return { sent: false, reason: "NOT_CONFIGURED" as const };
  }

  const parisNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const year = parisNow.getFullYear();
  const monthIndex = parisNow.getMonth();
  const month = monthIndex + 1;

  const lastSession = await getLastSessionOfMonth(season.id, year, monthIndex);
  if (!lastSession) {
    return { sent: false, reason: "NO_SESSION" as const };
  }

  if (!isSessionPast(lastSession.sessionDate, season.endTime)) {
    return { sent: false, reason: "SESSION_NOT_ENDED" as const };
  }

  if (await wasMonthReminderSent(season.id, year, month)) {
    return { sent: false, reason: "ALREADY_SENT" as const };
  }

  const existingValidation = await getMonthValidation(season.id, year, month);
  if (existingValidation?.lastSentAt) {
    await markMonthReminderSent(season.id, year, month);
    return { sent: false, reason: "ALREADY_VALIDATED" as const };
  }

  const managers = await listBillingRecipients("billing_manager");
  if (managers.length === 0) {
    return { sent: false, reason: "NO_MANAGER_EMAIL" as const };
  }

  const { sendValidationReminderEmail } = await import("@/lib/email");
  const monthLabel = formatMonthYear(year, monthIndex);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ppg-sausset.vercel.app";

  await sendValidationReminderEmail({
    to: managers.map((item) => item.email),
    monthLabel,
    appUrl,
  });

  await markMonthReminderSent(season.id, year, month);
  return { sent: true, monthLabel };
}

