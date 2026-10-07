import { NextResponse } from "next/server";
import { getPersonalLink } from "@/lib/auth";
import { normalizeEmail } from "@/lib/helpers";
import { upsertPaidMemberFromCasSites } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const secret = process.env.PPG_CAS_SYNC_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = request.headers.get("x-ppg-cas-sync-secret")?.trim() || "";
  return bearer === secret || alt === secret;
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase non configuré." },
      { status: 503 },
    );
  }

  if (!process.env.PPG_CAS_SYNC_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, error: "PPG_CAS_SYNC_SECRET manquant." },
      { status: 503 },
    );
  }

  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    createAccessProfile?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide." }, { status: 400 });
  }

  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const email = normalizeEmail(String(body.email || ""));
  if (!firstName || !lastName || !email) {
    return NextResponse.json(
      { ok: false, error: "firstName, lastName et email sont requis." },
      { status: 400 },
    );
  }

  try {
    const result = await upsertPaidMemberFromCasSites({
      firstName,
      lastName,
      email,
      createAccessProfile: body.createAccessProfile !== false,
    });

    const accessUrl = result.participant
      ? getPersonalLink(result.participant.accessToken)
      : null;

    return NextResponse.json({
      ok: true,
      seasonId: result.seasonId,
      paidMemberKey: result.paidMemberKey,
      createdParticipant: result.createdParticipant,
      accessUrl,
      participant: result.participant
        ? {
            id: result.participant.id,
            firstName: result.participant.firstName,
            lastName: result.participant.lastName,
            email: result.participant.email,
          }
        : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur sync";
    const status = message === "NO_ACTIVE_SEASON" ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
