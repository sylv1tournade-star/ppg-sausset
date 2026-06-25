import { NextResponse } from "next/server";
import { getParticipantSessions, searchParticipants } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ results: [] });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const participantId = searchParams.get("participantId");

  if (participantId) {
    const { season, sessions } = await getParticipantSessions(participantId);
    return NextResponse.json({ season, sessions });
  }

  const results = await searchParticipants(query);
  return NextResponse.json({ results });
}
