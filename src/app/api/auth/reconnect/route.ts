import { NextResponse } from "next/server";
import { setParticipantCookie } from "@/lib/auth";
import { CLUB_MEMBERSHIP_URL } from "@/lib/constants";
import { normalizeEmail } from "@/lib/helpers";
import { getParticipantByEmail, isPaidMemberForActiveSeason } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const body = (await request.json()) as { email?: string };
  const email = normalizeEmail(body.email ?? "");

  if (!email) {
    return NextResponse.json({ error: "E-mail requis." }, { status: 400 });
  }

  const participant = await getParticipantByEmail(email);
  if (!participant) {
    return NextResponse.json(
      { error: "Aucun profil trouvé pour cet e-mail. Créez d'abord votre profil." },
      { status: 404 },
    );
  }

  const membership = await isPaidMemberForActiveSeason(participant.firstName, participant.lastName);
  if (membership.reason === "NO_SEASON") {
    return NextResponse.json({ error: "Aucune saison active." }, { status: 400 });
  }
  if (membership.reason === "EMPTY_LIST") {
    return NextResponse.json(
      {
        error: "Les inscriptions ne sont pas encore ouvertes. Contactez Manon.",
        code: "LIST_NOT_READY",
      },
      { status: 403 },
    );
  }
  if (!membership.allowed && membership.reason === "NOT_FOUND") {
    return NextResponse.json(
      {
        error: "Votre adhésion au club n'est plus active ou votre nom n'est pas dans la liste des membres à jour.",
        code: "NOT_PAID_MEMBER",
        membershipUrl: CLUB_MEMBERSHIP_URL,
      },
      { status: 403 },
    );
  }

  await setParticipantCookie(participant.accessToken);

  return NextResponse.json({
    participant: {
      id: participant.id,
      firstName: participant.firstName,
      lastName: participant.lastName,
      email: participant.email,
    },
    accessToken: participant.accessToken,
  });
}
