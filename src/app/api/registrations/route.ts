import { NextResponse } from "next/server";
import { getParticipantToken } from "@/lib/auth";
import {
  enrichSessions,
  getActiveSeason,
  getParticipantByToken,
  getSessionsForSeason,
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

  if (action === "unregister") {
    await unregisterParticipant(sessionId, participant.id);
  } else {
    await registerParticipant(sessionId, participant.id);
  }

  const enriched = await enrichSessions(sessions, season, participant.id);
  return NextResponse.json({ sessions: enriched });
}
