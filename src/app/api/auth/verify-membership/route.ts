import { NextResponse } from "next/server";
import { CLUB_MEMBERSHIP_URL } from "@/lib/constants";
import { isPaidMemberForActiveSeason } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const body = (await request.json()) as { firstName?: string; lastName?: string };
  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Prénom et nom requis." }, { status: 400 });
  }

  const result = await isPaidMemberForActiveSeason(firstName, lastName);

  if (result.reason === "NO_SEASON") {
    return NextResponse.json({ eligible: false, code: "NO_SEASON", message: "Aucune saison active." });
  }

  if (result.reason === "EMPTY_LIST") {
    return NextResponse.json({
      eligible: false,
      code: "LIST_NOT_READY",
      message: "Les inscriptions ne sont pas encore ouvertes.",
    });
  }

  if (!result.allowed) {
    return NextResponse.json({
      eligible: false,
      code: "NOT_PAID_MEMBER",
      message: "Votre adhésion au club n'a pas été trouvée.",
      membershipUrl: CLUB_MEMBERSHIP_URL,
    });
  }

  return NextResponse.json({ eligible: true, code: result.reason });
}
