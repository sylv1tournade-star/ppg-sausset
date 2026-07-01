import { NextResponse } from "next/server";
import {
  clearAdminCookie,
  getAdminRole,
  isAdminAuthenticated,
  isSuperAdminAuthenticated,
  resolveAdminPin,
  setAdminCookie,
} from "@/lib/auth";
import {
  clearPaidMembers,
  createSeason,
  getActiveSeason,
  getAddableParticipantsForSession,
  getAttendanceForSession,
  getBureauStats,
  getSessionById,
  getSessionParticipants,
  getSessionsForSeason,
  importPaidMembers,
  listPaidMembers,
  listSeasons,
  markAllAttendance,
  markAttendance,
  notifySessionNotMaintained,
  registerAndMarkAttendance,
  updateSession,
} from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Accès admin requis." }, { status: 401 });
  }
  return null;
}

async function requireSuperAdmin() {
  if (!(await isSuperAdminAuthenticated())) {
    return NextResponse.json({ error: "Accès réservé à la responsable PPG." }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "ping") {
    const role = await getAdminRole();
    return NextResponse.json({
      admin: role !== null,
      role,
      superAdmin: role === "super_admin",
      superAdminConfigured: Boolean((process.env.PPG_SUPER_ADMIN_PIN ?? "").trim()),
    });
  }

  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  if (action === "seasons") {
    const seasons = await listSeasons();
    return NextResponse.json({ seasons });
  }

  if (action === "stats") {
    const deniedSuper = await requireSuperAdmin();
    if (deniedSuper) {
      return deniedSuper;
    }
    const stats = await getBureauStats();
    return NextResponse.json({ stats });
  }

  if (action === "members") {
    const deniedSuper = await requireSuperAdmin();
    if (deniedSuper) {
      return deniedSuper;
    }
    const season = await getActiveSeason();
    if (!season) {
      return NextResponse.json({ season: null, members: [], count: 0 });
    }
    const members = await listPaidMembers(season.id);
    return NextResponse.json({ season, members, count: members.length });
  }

  const season = await getActiveSeason();
  if (!season) {
    return NextResponse.json({ season: null, sessions: [] });
  }

  const sessionId = searchParams.get("sessionId");
  if (sessionId) {
    const deniedSuper = await requireSuperAdmin();
    if (deniedSuper) {
      return deniedSuper;
    }
    const [participants, attendance, addable] = await Promise.all([
      getSessionParticipants(sessionId),
      getAttendanceForSession(sessionId),
      getAddableParticipantsForSession(sessionId),
    ]);
    return NextResponse.json({ participants, attendance, addable });
  }

  const sessions = await getSessionsForSeason(season.id);
  return NextResponse.json({ season, sessions });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "login") {
    const pin = String(body.pin ?? "").trim();
    const role = resolveAdminPin(pin);
    if (!role) {
      return NextResponse.json({ error: "PIN incorrect." }, { status: 401 });
    }
    await setAdminCookie(role);
    return NextResponse.json({ ok: true, role });
  }

  if (action === "logout") {
    await clearAdminCookie();
    return NextResponse.json({ ok: true });
  }

  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  if (action === "season.create") {
    const deniedSuper = await requireSuperAdmin();
    if (deniedSuper) {
      return deniedSuper;
    }
    const startYear = Number(body.startYear);
    if (!Number.isFinite(startYear)) {
      return NextResponse.json({ error: "Année de début invalide." }, { status: 400 });
    }
    const season = await createSeason({
      startYear,
      dayOfWeek: body.dayOfWeek !== undefined ? Number(body.dayOfWeek) : 4,
      startTime: body.startTime ? String(body.startTime) : "19:00",
      endTime: body.endTime ? String(body.endTime) : "20:00",
      location: body.location ? String(body.location) : "Sausset-les-Pins",
    });
    const sessions = await getSessionsForSeason(season.id);
    return NextResponse.json({ season, sessionCount: sessions.length });
  }

  if (action === "session.update") {
    const sessionId = String(body.sessionId ?? "");
    if (!sessionId) {
      return NextResponse.json({ error: "Séance manquante." }, { status: 400 });
    }

    const previous = await getSessionById(sessionId);
    const nextStatus = body.status
      ? (String(body.status) as "scheduled" | "cancelled" | "rescheduled")
      : undefined;

    const session = await updateSession(sessionId, {
      status: nextStatus,
      theme: body.theme !== undefined ? String(body.theme) : undefined,
      notes: body.notes !== undefined ? String(body.notes) : undefined,
    });

    let notification: Awaited<ReturnType<typeof notifySessionNotMaintained>> | null = null;
    if (
      previous?.status === "scheduled" &&
      nextStatus &&
      (nextStatus === "cancelled" || nextStatus === "rescheduled")
    ) {
      notification = await notifySessionNotMaintained(sessionId, nextStatus);
    }

    return NextResponse.json({ session, notification });
  }

  if (action === "attendance.mark") {
    const deniedSuper = await requireSuperAdmin();
    if (deniedSuper) {
      return deniedSuper;
    }
    const sessionId = String(body.sessionId ?? "");
    const participantId = String(body.participantId ?? "");
    const status = String(body.status ?? "") as "present" | "absent" | "excused";
    if (!sessionId || !participantId || !["present", "absent", "excused"].includes(status)) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    await markAttendance(sessionId, participantId, status);
    const attendance = await getAttendanceForSession(sessionId);
    return NextResponse.json({ attendance });
  }

  if (action === "attendance.markAll") {
    const deniedSuper = await requireSuperAdmin();
    if (deniedSuper) {
      return deniedSuper;
    }
    const sessionId = String(body.sessionId ?? "");
    const status = String(body.status ?? "present") as "present" | "absent" | "excused";
    if (!sessionId || !["present", "absent", "excused"].includes(status)) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    const participants = await getSessionParticipants(sessionId);
    await markAllAttendance(
      sessionId,
      participants.map((participant) => participant.id),
      status,
    );
    const attendance = await getAttendanceForSession(sessionId);
    return NextResponse.json({ attendance });
  }

  if (action === "attendance.add") {
    const deniedSuper = await requireSuperAdmin();
    if (deniedSuper) {
      return deniedSuper;
    }
    const sessionId = String(body.sessionId ?? "");
    const participantId = String(body.participantId ?? "");
    if (!sessionId || !participantId) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    await registerAndMarkAttendance(sessionId, participantId, "present");
    const [participants, attendance, addable] = await Promise.all([
      getSessionParticipants(sessionId),
      getAttendanceForSession(sessionId),
      getAddableParticipantsForSession(sessionId),
    ]);
    return NextResponse.json({ participants, attendance, addable });
  }

  if (action === "members.import") {
    const deniedSuper = await requireSuperAdmin();
    if (deniedSuper) {
      return deniedSuper;
    }
    const season = await getActiveSeason();
    if (!season) {
      return NextResponse.json({ error: "Créez d'abord une saison active." }, { status: 400 });
    }
    const raw = String(body.raw ?? "");
    const mode = body.mode === "merge" ? "merge" : "replace";
    const result = await importPaidMembers(season.id, raw, mode);
    const members = await listPaidMembers(season.id);
    return NextResponse.json({ ...result, members });
  }

  if (action === "members.clear") {
    const deniedSuper = await requireSuperAdmin();
    if (deniedSuper) {
      return deniedSuper;
    }
    const season = await getActiveSeason();
    if (!season) {
      return NextResponse.json({ error: "Aucune saison active." }, { status: 400 });
    }
    await clearPaidMembers(season.id);
    return NextResponse.json({ count: 0 });
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
