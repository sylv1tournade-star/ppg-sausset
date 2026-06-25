import { NextResponse } from "next/server";
import { getParticipantToken } from "@/lib/auth";
import { CLUB_MEMBERSHIP_URL } from "@/lib/constants";
import { isSessionPast, isSessionRegisterable } from "@/lib/calendar";
import {
  enrichSessions,
  getActiveSeason,
  getParticipantByToken,
  getSessionsForSeason,
  isPaidMemberForActiveSeason,
  registerParticipant,
  unregisterParticipant,
} from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const token = await getParticipantToken();
  if (!token) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const participant = await getParticipantByToken(token);
  if (!participant) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 401 });
  }

  const body = (await request.json()) as { sessionId?: string; action?: "register" | "unregister" };
  const sessionId = body.sessionId ?? "";
  const action = body.action ?? "register";

  if (!sessionId) {
    return NextResponse.json({ error: "Séance manquante." }, { status: 400 });
  }

  const season = await getActiveSeason();
  if (!season) {
    return NextResponse.json({ error: "Aucune saison active." }, { status: 400 });
  }

  const sessions = await getSessionsForSeason(season.id);
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) {
    return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
  }

  if (session.status === "cancelled") {
    return NextResponse.json({ error: "Cette séance est annulée." }, { status: 400 });
  }

  if (session.status === "rescheduled") {
    return NextResponse.json({ error: "Cette séance est reportée. Inscription impossible." }, { status: 400 });
  }

  if (action === "unregister") {
    await unregisterParticipant(sessionId, participant.id);
  } else {
    if (isSessionPast(session.sessionDate, season.endTime)) {
      return NextResponse.json({ error: "Cette séance est déjà passée." }, { status: 400 });
    }

    if (!isSessionRegisterable(session, season)) {
      return NextResponse.json({ error: "Inscription impossible pour cette séance." }, { status: 400 });
    }

    const membership = await isPaidMemberForActiveSeason(participant.firstName, participant.lastName);
    if (membership.reason === "NO_SEASON") {
      return NextResponse.json({ error: "Aucune saison active." }, { status: 400 });
    }
    if (membership.reason === "EMPTY_LIST") {
      return NextResponse.json({ error: "Les inscriptions ne sont pas ouvertes." }, { status: 403 });
    }
    if (!membership.allowed) {
      return NextResponse.json(
        {
          error: "Votre adhésion au club n'est pas à jour.",
          code: "NOT_PAID_MEMBER",
          membershipUrl: CLUB_MEMBERSHIP_URL,
        },
        { status: 403 },
      );
    }

    await registerParticipant(sessionId, participant.id);
  }

  const enriched = await enrichSessions(sessions, season, participant.id);
  return NextResponse.json({ sessions: enriched });
}
