import { NextResponse } from "next/server";
import { maybeSendMonthValidationReminder } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  try {
    const result = await maybeSendMonthValidationReminder();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur";
    if (message.startsWith("BREVO_SEND_FAILED")) {
      return NextResponse.json({ error: "Échec envoi Brevo." }, { status: 502 });
    }
    throw error;
  }
}
