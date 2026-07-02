"use client";

import { SessionDetail } from "@/components/session-detail";
import type { Season, SessionWithMeta } from "@/lib/types";

type Props = {
  session: SessionWithMeta;
  season: Season;
  isLoggedIn: boolean;
};

export function SessionDetailPublic({ session, season, isLoggedIn }: Props) {
  return (
    <SessionDetail
      session={session}
      season={season}
      isLoggedIn={isLoggedIn}
      onSessionsUpdate={() => {
        window.location.reload();
      }}
    />
  );
}
