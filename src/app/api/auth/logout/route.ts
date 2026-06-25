import { NextResponse } from "next/server";
import { clearParticipantCookie } from "@/lib/auth";

export async function POST() {
  await clearParticipantCookie();
  return NextResponse.json({ ok: true });
}
