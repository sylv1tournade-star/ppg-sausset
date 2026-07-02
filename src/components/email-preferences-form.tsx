"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  token: string;
  firstName: string;
  initialEnabled: boolean;
};

export function EmailPreferencesForm({ token, firstName, initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextEnabled: boolean) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/email-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, enabled: nextEnabled }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      setEnabled(data.emailRemindersEnabled);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);

  return (
    <section className="card p-6">
      <h1 className="text-2xl font-bold">Préférences e-mail</h1>
      <p className="muted mt-2 text-sm">Bonjour {firstName},</p>
      <p className="mt-4 text-sm">
        Les rappels la veille de séance et les informations importantes (annulation, report) peuvent être envoyés par
        e-mail.
      </p>
      <label className="mt-5 flex items-start gap-3 rounded-xl border border-[var(--border)] px-4 py-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={enabled}
          disabled={busy}
          onChange={(event) => void save(event.target.checked)}
        />
        <span className="text-sm">
          <strong>Recevoir le rappel la veille</strong>
          <span className="muted block mt-1">
            Un e-mail la veille du jeudi si vous êtes inscrit(e). Les annulations restent toujours notifiées.
          </span>
        </span>
      </label>
      {saved ? <p className="mt-3 text-sm text-[var(--accent)]">Préférence enregistrée.</p> : null}
      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      <Link href="/" className="btn btn-secondary mt-5">
        Retour au calendrier
      </Link>
    </section>
  );
}
