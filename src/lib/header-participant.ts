import { getParticipantToken } from "@/lib/auth";
import { getParticipantByToken } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function getHeaderParticipantName() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const token = await getParticipantToken();
  if (!token) {
    return null;
  }

  const participant = await getParticipantByToken(token);
  if (!participant) {
    return null;
  }

  return `${participant.firstName} ${participant.lastName}`;
}
