import { SiteHeader } from "@/components/site-header";
import { getHeaderParticipantName } from "@/lib/header-participant";

export async function AppHeader() {
  const participantName = await getHeaderParticipantName();
  return <SiteHeader participantName={participantName} />;
}
