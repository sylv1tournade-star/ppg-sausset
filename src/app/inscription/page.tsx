"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CLUB_MEMBERSHIP_URL, PPG_LICENSE_MESSAGE } from "@/lib/constants";

export default function InscriptionPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notMember, setNotMember] = useState(false);
  const [personalLink, setPersonalLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotMember(false);
    try {
      const verify = await fetch("/api/auth/verify-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      const verifyData = await verify.json();
      if (!verify.ok && verifyData.code === "NOT_PAID_MEMBER") {
        setNotMember(true);
        return;
      }
      if (!verify.ok) {
        throw new Error(verifyData.message ?? verifyData.error ?? "Erreur");
      }

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "NOT_PAID_MEMBER") {
          setNotMember(true);
          return;
        }
        throw new Error(data.error ?? "Erreur");
      }
      const link = `${window.location.origin}/m/${data.accessToken}`;
      setPersonalLink(link);
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
        <h1 className="text-2xl font-bold">Créer mon profil PPG</h1>
        <p className="muted mt-2">
          Réservé aux membres du club à jour de leur adhésion. Pas de mot de passe : votre e-mail sert à vous
          reconnecter.
        </p>

        {personalLink ? (
          <div className="mt-6 space-y-4 rounded-xl bg-[var(--accent-soft)] p-4">
            <p className="font-semibold">Profil créé.</p>
            <p className="text-sm">
              Gardez ce lien personnel (signet ou note) pour retrouver votre espace sans ressaisir l&apos;e-mail :
            </p>
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
            <p className="font-semibold">Option PPG non souscrite</p>
            <p className="text-sm">{PPG_LICENSE_MESSAGE}</p>
            <p className="text-sm">
              Pour participer aux séances PPG, reprenez votre licence en cochant l&apos;option PPG, ou contactez le
              club.
            </p>
            <a href={CLUB_MEMBERSHIP_URL} className="btn btn-primary" target="_blank" rel="noreferrer">
              Adhérer au club
            </a>
            <p className="text-sm">
              Déjà membre ? Vérifiez l&apos;orthographe de votre prénom/nom ou contactez Manon.
            </p>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Prénom</span>
              <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Nom</span>
              <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </label>
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
              {busy ? "Vérification..." : "Créer mon profil"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
