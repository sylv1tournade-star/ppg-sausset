import { EmailPreferencesForm } from "@/components/email-preferences-form";
import { getParticipantByToken } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function DesabonnementPage({ params }: Props) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="container max-w-md">
        <section className="card p-6">Supabase non configuré.</section>
      </div>
    );
  }

  const participant = await getParticipantByToken(token);
  if (!participant) {
    return (
      <div className="container max-w-md">
        <section className="card p-6">
          <h1 className="text-xl font-bold">Lien invalide</h1>
          <p className="muted mt-2 text-sm">Ce lien de préférences n&apos;est plus valide.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="container max-w-md">
      <EmailPreferencesForm
        token={token}
        firstName={participant.firstName}
        initialEnabled={participant.emailRemindersEnabled !== false}
      />
    </div>
  );
}
