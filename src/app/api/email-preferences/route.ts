import { NextResponse } from "next/server";
import { getParticipantByToken, setEmailRemindersEnabled } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token manquant." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const participant = await getParticipantByToken(token);
  if (!participant) {
    return NextResponse.json({ error: "Lien invalide." }, { status: 404 });
  }

  return NextResponse.json({
    firstName: participant.firstName,
    emailRemindersEnabled: participant.emailRemindersEnabled !== false,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const body = (await request.json()) as { token?: string; enabled?: boolean };
  const token = String(body.token ?? "");
  if (!token) {
    return NextResponse.json({ error: "Token manquant." }, { status: 400 });
  }

  const participant = await setEmailRemindersEnabled(token, Boolean(body.enabled));
  if (!participant) {
    return NextResponse.json({ error: "Lien invalide." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    emailRemindersEnabled: participant.emailRemindersEnabled !== false,
  });
}
