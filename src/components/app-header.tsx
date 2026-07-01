import { SiteHeader } from "@/components/site-header";
import { formatSeasonScheduleTagline } from "@/lib/calendar";
import { getHeaderParticipantName } from "@/lib/header-participant";
import { getActiveSeason } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function AppHeader() {
  const participantName = await getHeaderParticipantName();
  let scheduleTagline = "Préparation physique";
  if (isSupabaseConfigured()) {
    const season = await getActiveSeason();
    if (season) {
      scheduleTagline = formatSeasonScheduleTagline(season);
    }
  }
  return <SiteHeader participantName={participantName} scheduleTagline={scheduleTagline} />;
}
