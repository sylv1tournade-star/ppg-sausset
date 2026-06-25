import { getRanking } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export default async function ClassementPage() {
  const ranking = isSupabaseConfigured() ? await getRanking(10) : [];

  return (
    <div className="container max-w-3xl">
      <section className="card p-6">
        <h1 className="text-2xl font-bold">Top 10 assiduité</h1>
        <p className="muted mt-2">
          Classement public sur les séances passées (minimum 3 inscriptions). Présences / inscriptions.
        </p>
        {ranking.length === 0 ? (
          <p className="muted mt-4">Pas encore assez de données.</p>
        ) : (
          <ol className="mt-6 space-y-3">
            {ranking.map((entry, index) => (
              <li key={entry.participantId} className="flex items-center gap-4 rounded-xl bg-[var(--bg)] px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent)]">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">
                    {entry.firstName} {entry.lastName}
                  </p>
                  <p className="muted text-sm">
                    {entry.presentCount} présence{entry.presentCount > 1 ? "s" : ""} sur {entry.registeredCount}{" "}
                    inscription{entry.registeredCount > 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-lg font-bold text-[var(--accent)]">{entry.rate}%</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
