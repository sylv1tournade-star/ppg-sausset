import { NextResponse } from "next/server";
import { buildGoogleCalendarUrl, buildIcsFile } from "@/lib/calendar";
import { getActiveSeason, getSessionsForSeason } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const { sessionId } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "json";

  const season = await getActiveSeason();
  if (!season) {
    return NextResponse.json({ error: "Aucune saison active." }, { status: 404 });
  }

  const sessions = await getSessionsForSeason(season.id);
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) {
    return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
  }

  const title = `PPG Courir à Sausset${session.theme ? ` — ${session.theme}` : ""}`;
  const details = [
    "Séance de préparation physique générale avec Manon.",
    session.notes ? `Notes : ${session.notes}` : null,
    session.status === "cancelled" ? "Séance annulée." : null,
  ]
    .filter(Boolean)
    .join("\n");

  const payload = {
    googleUrl: buildGoogleCalendarUrl({
      dateIso: session.sessionDate,
      startTime: season.startTime,
      endTime: season.endTime,
      title,
      details,
      location: season.location,
    }),
    icsUrl: `/api/calendar/${sessionId}?format=ics`,
  };

  if (format === "ics") {
    const ics = buildIcsFile({
      dateIso: session.sessionDate,
      startTime: season.startTime,
      endTime: season.endTime,
      title,
      details,
      location: season.location,
      uid: `ppg-${session.id}@courir-a-sausset`,
    });

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="ppg-${session.sessionDate}.ics"`,
      },
    });
  }

  return NextResponse.json(payload);
}
