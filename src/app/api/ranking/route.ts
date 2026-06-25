import { NextResponse } from "next/server";
import { getRanking } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ranking: [] });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "10");
  const ranking = await getRanking(Number.isFinite(limit) ? limit : 10);
  return NextResponse.json({ ranking });
}
