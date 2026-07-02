import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionDetailPublic } from "@/components/session-detail-public";
import { getParticipantToken } from "@/lib/auth";
import {
  enrichSessions,
  getActiveSeason,
  getSessionById,
  getSessionsForSeason,
} from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function SeancePage({ params }: Props) {
  const { sessionId } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="container max-w-xl">
        <section className="card p-6">Supabase non configuré.</section>
      </div>
    );
  }

  const season = await getActiveSeason();
  if (!season) {
    notFound();
  }

  const session = await getSessionById(sessionId);
  if (!session || session.seasonId !== season.id) {
    notFound();
  }

  const token = await getParticipantToken();
  const allSessions = await enrichSessions(await getSessionsForSeason(season.id), season, token);
  const enriched = allSessions.find((item) => item.id === sessionId);
  if (!enriched) {
    notFound();
  }

  return (
    <div className="container max-w-xl space-y-4">
      <Link href="/" className="inline-flex text-sm font-semibold text-[var(--accent)]">
        ← Calendrier PPG
      </Link>
      <SessionDetailPublic session={enriched} season={season} isLoggedIn={Boolean(token)} />
    </div>
  );
}
