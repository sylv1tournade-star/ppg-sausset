import { NextResponse } from "next/server";
import { getParticipantToken } from "@/lib/auth";
import {
  enrichSessions,
  getActiveSeason,
  getParticipantByToken,
  getSessionsForSeason,
} from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ season: null, sessions: [] });
  }

  const season = await getActiveSeason();
  if (!season) {
    return NextResponse.json({ season: null, sessions: [] });
  }

  const token = await getParticipantToken();
  const participant = token ? await getParticipantByToken(token) : null;
  const sessions = await getSessionsForSeason(season.id);
  const enriched = await enrichSessions(sessions, season, participant?.id ?? null);

  return NextResponse.json({ season, sessions: enriched });
}
