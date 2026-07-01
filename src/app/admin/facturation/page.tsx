"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatMonthYear, formatParisShortDate, parseMonthKey } from "@/lib/calendar";
import type { MonthBillingPreview, MonthValidation, TreasurerEmail } from "@/lib/types";

export default function FacturationPage() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [treasurers, setTreasurers] = useState<TreasurerEmail[]>([]);
  const [validations, setValidations] = useState<MonthValidation[]>([]);
  const [brevoConfigured, setBrevoConfigured] = useState(false);
  const [newTreasurerEmail, setNewTreasurerEmail] = useState("");
  const [newTreasurerLabel, setNewTreasurerLabel] = useState("");
  const [monthKeys, setMonthKeys] = useState<string[]>([]);
  const [previewMonthKey, setPreviewMonthKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<MonthBillingPreview | null>(null);
  const [billedCount, setBilledCount] = useState(0);
  const [billingNote, setBillingNote] = useState("");

  async function refresh() {
    const ping = await fetch("/api/admin?action=ping");
    const pingData = await ping.json();
    setRole(pingData.role ?? null);
    if (pingData.role !== "super_admin") {
      setLoading(false);
      return;
    }

    const [configRes, treasurersRes, validationsRes, adminRes] = await Promise.all([
      fetch("/api/admin/billing?action=config"),
      fetch("/api/admin/billing?action=treasurers"),
      fetch("/api/admin/billing?action=validations"),
      fetch("/api/admin"),
    ]);

    const configData = await configRes.json();
    const treasurersData = await treasurersRes.json();
    const validationsData = await validationsRes.json();
    const adminData = await adminRes.json();

    setBrevoConfigured(Boolean(configData.brevoConfigured));
    setTreasurers(treasurersData.treasurers ?? []);
    setValidations(validationsData.validations ?? []);

    const keys = new Set<string>();
    for (const session of adminData.sessions ?? []) {
      keys.add(session.sessionDate.slice(0, 7));
    }
    setMonthKeys(Array.from(keys).sort());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const validationByMonth = useMemo(() => {
    const map = new Map<string, MonthValidation>();
    for (const validation of validations) {
      map.set(`${validation.year}-${String(validation.month).padStart(2, "0")}`, validation);
    }
    return map;
  }, [validations]);

  async function addTreasurer() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "treasurers.add",
          email: newTreasurerEmail,
          label: newTreasurerLabel,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      setTreasurers(data.treasurers ?? []);
      setNewTreasurerEmail("");
      setNewTreasurerLabel("");
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function removeTreasurer(id: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "treasurers.remove", id }),
      });
      const data = await response.json();
      if (response.ok) {
        setTreasurers(data.treasurers ?? []);
      }
    } finally {
      setBusy(false);
    }
  }

  async function openPreview(monthKey: string) {
    const { year, month } = parseMonthKey(monthKey);
    setPreviewMonthKey(monthKey);
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/billing?year=${year}&month=${month + 1}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      const nextPreview = data.preview as MonthBillingPreview;
      setPreview(nextPreview);
      setBilledCount(nextPreview.lastValidation?.billedSessionCount ?? nextPreview.computedSessionCount);
      setBillingNote(nextPreview.lastValidation?.billingNote ?? "");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Erreur");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function sendValidation() {
    if (!previewMonthKey || !preview) {
      return;
    }
    const { year, month } = parseMonthKey(previewMonthKey);
    const validation = validationByMonth.get(previewMonthKey);
    const confirmText = validation?.lastSentAt
      ? "Renvoyer l'e-mail aux trésoriers avec les données mises à jour ?"
      : "Valider ce mois et envoyer l'e-mail aux trésoriers ?";
    if (!window.confirm(confirmText)) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          year,
          month: month + 1,
          billedSessionCount: billedCount,
          billingNote,
          sendEmail: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      setPreview(data.preview ?? preview);
      await refresh();
      setPreviewMonthKey(null);
      setPreview(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="container max-w-3xl">
        <section className="card p-6">Chargement…</section>
      </div>
    );
  }

  if (role !== "super_admin") {
    return (
      <div className="container max-w-xl space-y-4">
        <section className="card p-6">
          <h1 className="text-2xl font-bold">Facturation PPG</h1>
          <p className="muted mt-2">
            {role === "admin"
              ? "Cet espace est réservé à Suzanne (responsable PPG)."
              : "Connectez-vous avec le PIN responsable PPG."}
          </p>
          <Link href="/admin" className="btn btn-primary mt-4">
            Retour à l&apos;admin
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Facturation PPG</h1>
            <p className="muted mt-2 text-sm">
              Validation mensuelle et envoi aux trésoriers. Accès responsable PPG uniquement.
            </p>
          </div>
          <Link href="/admin" className="btn btn-secondary">
            Admin coach
          </Link>
        </div>
        {!brevoConfigured ? (
          <p className="mt-4 rounded-lg border border-[var(--warn)] bg-[#fff3cd] px-3 py-2 text-sm text-[#856404]">
            Brevo n&apos;est pas encore configuré : l&apos;envoi d&apos;e-mails ne fonctionnera pas tant que les
            variables BREVO ne sont pas ajoutées sur Vercel.
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-bold">E-mails des trésoriers</h2>
        <p className="muted mt-2 text-sm">Modifiables directement ici, sans toucher au code.</p>
        <ul className="mt-4 space-y-2">
          {treasurers.length === 0 ? (
            <li className="muted text-sm">Aucun destinataire pour le moment.</li>
          ) : (
            treasurers.map((treasurer) => (
              <li
                key={treasurer.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bg)] px-3 py-2"
              >
                <span>
                  {treasurer.email}
                  {treasurer.label ? <span className="muted text-sm"> · {treasurer.label}</span> : null}
                </span>
                <button type="button" className="btn btn-danger text-xs" onClick={() => removeTreasurer(treasurer.id)}>
                  Retirer
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="input min-w-[14rem] flex-1"
            type="email"
            placeholder="E-mail trésorier"
            value={newTreasurerEmail}
            onChange={(event) => setNewTreasurerEmail(event.target.value)}
          />
          <input
            className="input min-w-[10rem]"
            placeholder="Libellé (optionnel)"
            value={newTreasurerLabel}
            onChange={(event) => setNewTreasurerLabel(event.target.value)}
          />
          <button type="button" className="btn btn-primary" disabled={busy || !newTreasurerEmail.trim()} onClick={addTreasurer}>
            Ajouter
          </button>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-bold">Valider les cours du mois</h2>
        <p className="muted mt-2 text-sm">
          Une séance est comptée comme réalisée si elle est passée, non annulée, avec au moins un présent et toutes les
          présences renseignées. Vous pouvez corriger le nombre de séances facturées avant l&apos;envoi.
        </p>
        <ul className="mt-4 space-y-2">
          {monthKeys.map((monthKey) => {
            const { year, month } = parseMonthKey(monthKey);
            const label = formatMonthYear(year, month);
            const validation = validationByMonth.get(monthKey);
            return (
              <li
                key={monthKey}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-4 py-3"
              >
                <div>
                  <p className="font-medium capitalize">{label}</p>
                  {validation?.lastSentAt ? (
                    <p className="muted text-sm">
                      Envoyé {validation.sendCount} fois · dernière fois le{" "}
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
                        new Date(validation.lastSentAt),
                      )}
                      {validation.billedSessionCount !== validation.computedSessionCount
                        ? ` · ${validation.billedSessionCount} séance(s) facturée(s) (calcul : ${validation.computedSessionCount})`
                        : ` · ${validation.billedSessionCount} séance(s)`}
                    </p>
                  ) : (
                    <p className="muted text-sm">Pas encore validé</p>
                  )}
                </div>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => openPreview(monthKey)}>
                  {validation?.lastSentAt ? "Renvoyer" : "Valider"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {preview && previewMonthKey ? (
        <section className="card p-6">
          <h2 className="text-xl font-bold capitalize">Aperçu — {preview.monthLabel}</h2>

          {preview.blockingIssues.length > 0 ? (
            <div className="mt-4 rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              <p className="font-semibold">Validation bloquée :</p>
              <ul className="mt-1 list-disc pl-5">
                {preview.blockingIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-4 text-sm">
            <strong>{preview.computedSessionCount}</strong> séance{preview.computedSessionCount > 1 ? "s" : ""} réalisée
            {preview.computedSessionCount > 1 ? "s" : ""} (calcul automatique)
          </p>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium">Nombre de séances pour la facturation</span>
            <input
              className="input max-w-[8rem]"
              type="number"
              min={0}
              value={billedCount}
              onChange={(event) => setBilledCount(Number(event.target.value))}
            />
          </label>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium">Note pour les trésoriers (optionnel)</span>
            <textarea
              className="input min-h-20"
              placeholder="Ex. : 3 séances facturées (une séance reportée en décembre)"
              value={billingNote}
              onChange={(event) => setBillingNote(event.target.value)}
            />
          </label>

          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-semibold">Séances réalisées</h3>
            {preview.realizedSessions.length === 0 ? (
              <p className="muted text-sm">Aucune séance réalisée selon les critères.</p>
            ) : (
              preview.realizedSessions.map((session) => (
                <article key={session.id} className="rounded-xl bg-[var(--bg)] px-4 py-3">
                  <p className="font-medium">{formatParisShortDate(session.sessionDate)}</p>
                  {session.theme ? <p className="muted text-sm">{session.theme}</p> : null}
                  <p className="mt-1 text-sm">
                    {session.presentCount} présent{session.presentCount > 1 ? "s" : ""} :{" "}
                    {session.presentParticipants.map((p) => `${p.firstName} ${p.lastName}`).join(", ")}
                  </p>
                </article>
              ))
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !preview.canValidate || treasurers.length === 0 || !brevoConfigured}
              onClick={sendValidation}
            >
              {preview.lastValidation?.lastSentAt ? "Renvoyer aux trésoriers" : "Valider et envoyer"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setPreview(null);
                setPreviewMonthKey(null);
              }}
            >
              Fermer
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
