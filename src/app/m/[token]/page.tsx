import { redirect } from "next/navigation";
import { setParticipantCookie } from "@/lib/auth";
import { getParticipantByToken } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export default async function MagicLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const participant = await getParticipantByToken(token);
  if (!participant) {
    redirect("/connexion");
  }

  await setParticipantCookie(token);
  redirect("/moi");
}
