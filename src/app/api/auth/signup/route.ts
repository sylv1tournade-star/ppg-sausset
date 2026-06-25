import { NextResponse } from "next/server";
import { generateAccessToken, setParticipantCookie } from "@/lib/auth";
import { CLUB_MEMBERSHIP_URL } from "@/lib/constants";
import { normalizeEmail } from "@/lib/helpers";
import { createParticipant, getParticipantByEmail, isPaidMemberForActiveSeason } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const body = (await request.json()) as {
    firstName?: string;
    lastName?: string;
    email?: string;
  };

  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  const email = normalizeEmail(body.email ?? "");

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: "Prénom, nom et e-mail sont obligatoires." }, { status: 400 });
  }

  const membership = await isPaidMemberForActiveSeason(firstName, lastName);
  if (membership.reason === "NO_SEASON") {
    return NextResponse.json({ error: "Aucune saison active. Revenez plus tard." }, { status: 400 });
  }
  if (membership.reason === "EMPTY_LIST") {
    return NextResponse.json(
      {
        error: "Les inscriptions ne sont pas encore ouvertes. La liste des adhérents n'a pas été importée par l'admin.",
        code: "LIST_NOT_READY",
      },
      { status: 403 },
    );
  }
  if (!membership.allowed) {
    return NextResponse.json(
      {
        error: "Adhésion non trouvée. Il faut être membre du club pour accéder au PPG.",
        code: "NOT_PAID_MEMBER",
        membershipUrl: CLUB_MEMBERSHIP_URL,
      },
      { status: 403 },
    );
  }

  const existing = await getParticipantByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "Cet e-mail est déjà utilisé. Utilisez la reconnexion." },
      { status: 409 },
    );
  }

  const accessToken = generateAccessToken();
  const participant = await createParticipant({
    firstName,
    lastName,
    email,
    accessToken,
  });

  await setParticipantCookie(accessToken);

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
