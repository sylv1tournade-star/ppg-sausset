import { NextResponse } from "next/server";
import { getParticipantToken } from "@/lib/auth";
import { getParticipantByToken } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ participant: null });
  }

  const token = await getParticipantToken();
  if (!token) {
    return NextResponse.json({ participant: null });
  }

  const participant = await getParticipantByToken(token);
  if (!participant) {
    return NextResponse.json({ participant: null });
  }

  return NextResponse.json({
    participant: {
      id: participant.id,
      firstName: participant.firstName,
      lastName: participant.lastName,
      email: participant.email,
      accessToken: participant.accessToken,
    },
  });
}
