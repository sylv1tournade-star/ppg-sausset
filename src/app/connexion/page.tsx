"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CLUB_MEMBERSHIP_URL } from "@/lib/constants";

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notMember, setNotMember] = useState(false);
  const [personalLink, setPersonalLink] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotMember(false);
    try {
      const response = await fetch("/api/auth/reconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "NOT_PAID_MEMBER") {
          setNotMember(true);
          return;
        }
        throw new Error(data.error ?? "Erreur");
      }
      setWelcomeName(`${data.participant.firstName} ${data.participant.lastName}`);
      setPersonalLink(`${window.location.origin}/m/${data.accessToken}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container max-w-xl">
      <section className="card p-6">
        <h1 className="text-2xl font-bold">Se reconnecter</h1>
        <p className="muted mt-2">
          Saisissez l&apos;e-mail utilisé à la création du profil. Nous vérifions qu&apos;il correspond à un profil
          existant et que vous êtes toujours dans la liste des adhérents à jour.
        </p>

        {personalLink ? (
          <div className="mt-6 space-y-4 rounded-xl bg-[var(--accent-soft)] p-4">
            <p className="font-semibold">Bonjour {welcomeName} — connexion réussie.</p>
            <p className="text-sm">Votre lien personnel (à conserver) :</p>
            <code className="block break-all rounded-lg bg-white p-3 text-sm">{personalLink}</code>
            <div className="flex flex-wrap gap-2">
              <Link href="/moi" className="btn btn-primary">
                Mon espace
              </Link>
              <Link href="/" className="btn btn-secondary">
                Voir les séances
              </Link>
            </div>
          </div>
        ) : notMember ? (
          <div className="mt-6 space-y-4 rounded-xl bg-[#fff3cd] p-4 text-[#664d03]">
            <p className="font-semibold">Adhésion non trouvée</p>
            <p className="text-sm">
              L&apos;e-mail correspond à un profil, mais votre nom n&apos;est plus dans la liste des membres à jour.
            </p>
            <a href={CLUB_MEMBERSHIP_URL} className="btn btn-primary" target="_blank" rel="noreferrer">
              Adhérer au club
            </a>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-1">
              <span className="text-sm font-medium">E-mail</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Connexion..." : "Me reconnecter"}
            </button>
            <p className="text-sm">
              Pas encore de profil ?{" "}
              <Link href="/inscription" className="font-semibold text-[var(--accent)]">
                Créer mon profil
              </Link>
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
