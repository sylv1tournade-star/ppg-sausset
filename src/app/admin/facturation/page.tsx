"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ACCOUNTING_STATUS_LABELS } from "@/lib/billing";
import { formatMonthYear, formatParisShortDate, parseMonthKey } from "@/lib/calendar";
import type {
  BillingAccountingStatus,
  BillingRecipientType,
  BillingSessionRow,
  MonthBillingPreview,
  MonthValidation,
  PaidMember,
  TreasurerEmail,
} from "@/lib/types";

const RECIPIENT_SECTIONS: Array<{ type: BillingRecipientType; title: string; hint: string }> = [
  {
    type: "treasurer",
    title: "Trésoriers",
    hint: "Destinataires principaux du PDF de facturation.",
  },
  {
    type: "coach",
    title: "Manon (coach)",
    hint: "Reçoit une copie de l'e-mail de validation.",
  },
  {
    type: "billing_manager",
    title: "Suzanne (responsable PPG)",
    hint: "Reçoit une copie + le rappel après le dernier jeudi du mois.",
  },
];

function initialStatuses(preview: MonthBillingPreview) {
  const statusMap: Record<string, BillingAccountingStatus> = {};
  const commentMap: Record<string, string> = {};
  for (const session of preview.sessions) {
    const saved = preview.lastValidation?.sessionSnapshot.find((item) => item.id === session.id);
    const savedStatus = saved?.accountingStatus as string | undefined;
    statusMap[session.id] =
      savedStatus && savedStatus !== "not_held"
        ? (savedStatus as BillingAccountingStatus)
        : session.suggestedAccountingStatus;
    commentMap[session.id] = saved?.comment ?? "";
  }
  return { statusMap, commentMap };
}

function countBillable(statuses: Record<string, BillingAccountingStatus>) {
  return Object.values(statuses).filter((status) => status === "realized").length;
}

export default function FacturationPage() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recipients, setRecipients] = useState<TreasurerEmail[]>([]);
  const [validations, setValidations] = useState<MonthValidation[]>([]);
  const [brevoConfigured, setBrevoConfigured] = useState(false);
  const [monthKeys, setMonthKeys] = useState<string[]>([]);
  const [previewMonthKey, setPreviewMonthKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<MonthBillingPreview | null>(null);
  const [sessionStatuses, setSessionStatuses] = useState<Record<string, BillingAccountingStatus>>({});
  const [sessionComments, setSessionComments] = useState<Record<string, string>>({});
  const [billedCount, setBilledCount] = useState(0);
  const [billingNote, setBillingNote] = useState("");
  const [newEmails, setNewEmails] = useState<Record<BillingRecipientType, { email: string; label: string }>>({
    treasurer: { email: "", label: "" },
    coach: { email: "", label: "" },
    billing_manager: { email: "", label: "" },
  });
  const [paidMembers, setPaidMembers] = useState<PaidMember[]>([]);
  const [importRaw, setImportRaw] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");

  async function refresh() {
    const ping = await fetch("/api/admin?action=ping");
    const pingData = await ping.json();
    setRole(pingData.role ?? null);
    if (pingData.role !== "super_admin") {
      setLoading(false);
      return;
    }

    const [configRes, recipientsRes, validationsRes, adminRes, membersRes] = await Promise.all([
      fetch("/api/admin/billing?action=config"),
      fetch("/api/admin/billing?action=recipients"),
      fetch("/api/admin/billing?action=validations"),
      fetch("/api/admin"),
      fetch("/api/admin/billing?action=members"),
    ]);

    const configData = await configRes.json();
    let recipientsData = await recipientsRes.json();
    const validationsData = await validationsRes.json();
    const adminData = await adminRes.json();
    const membersData = await membersRes.json();

    if ((recipientsData.recipients ?? []).length === 0) {
      const seedRes = await fetch("/api/admin/billing?action=seed");
      if (seedRes.ok) {
        recipientsData = await seedRes.json();
      }
    }

    setBrevoConfigured(Boolean(configData.brevoConfigured));
    setRecipients(recipientsData.recipients ?? []);
    setValidations(validationsData.validations ?? []);
    setPaidMembers(membersData.members ?? []);

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

  const recipientsByType = useMemo(() => {
    const map: Record<BillingRecipientType, TreasurerEmail[]> = {
      treasurer: [],
      coach: [],
      billing_manager: [],
    };
    for (const recipient of recipients) {
      map[recipient.recipientType].push(recipient);
    }
    return map;
  }, [recipients]);

  async function addRecipient(type: BillingRecipientType) {
    const draft = newEmails[type];
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "recipients.add",
          recipientType: type,
          email: draft.email,
          label: draft.label,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      setRecipients(data.recipients ?? []);
      setNewEmails((current) => ({ ...current, [type]: { email: "", label: "" } }));
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function removeRecipient(id: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recipients.remove", id }),
      });
      const data = await response.json();
      if (response.ok) {
        setRecipients(data.recipients ?? []);
      }
    } finally {
      setBusy(false);
    }
  }

  async function importMembers() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "members.import", raw: importRaw, mode: importMode }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      setPaidMembers(data.members ?? []);
      setImportRaw("");
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function clearMembers() {
    if (!window.confirm("Vider la liste des adhérents à jour ?")) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "members.clear" }),
      });
      const data = await response.json();
      if (response.ok) {
        setPaidMembers(data.members ?? []);
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
      const { statusMap, commentMap } = initialStatuses(nextPreview);
      setPreview(nextPreview);
      setSessionStatuses(statusMap);
      setSessionComments(commentMap);
      setBilledCount(nextPreview.lastValidation?.billedSessionCount ?? countBillable(statusMap));
      setBillingNote(nextPreview.lastValidation?.billingNote ?? "");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Erreur");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  function updateSessionStatus(sessionId: string, accountingStatus: BillingAccountingStatus) {
    setSessionStatuses((current) => {
      const next = { ...current, [sessionId]: accountingStatus };
      setBilledCount(countBillable(next));
      return next;
    });
  }

  async function sendValidation() {
    if (!previewMonthKey || !preview) {
      return;
    }
    const { year, month } = parseMonthKey(previewMonthKey);
    const validation = validationByMonth.get(previewMonthKey);
    const confirmText = validation?.lastSentAt
      ? "Renvoyer l'e-mail aux trésoriers (Manon et Suzanne en copie) ?"
      : "Valider ce mois comptablement et envoyer l'e-mail ?";
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
          sessionStatuses: Object.entries(sessionStatuses).map(([sessionId, accountingStatus]) => ({
            sessionId,
            accountingStatus,
            comment: sessionComments[sessionId] ?? "",
          })),
          sendEmail: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur");
      }
      await refresh();
      setPreviewMonthKey(null);
      setPreview(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  function renderSessionRow(session: BillingSessionRow) {
    const status = sessionStatuses[session.id] ?? session.suggestedAccountingStatus;
    const isFuture = status === "future";

    return (
      <article key={session.id} className="rounded-xl border border-[var(--border)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[12rem] flex-1">
            <p className="font-medium">{formatParisShortDate(session.sessionDate)}</p>
            {session.theme ? <p className="muted text-sm">{session.theme}</p> : null}
            <p className="muted mt-1 text-sm">
              {session.registeredCount} inscrit(s) en ligne
              {session.registeredCount > 0 ? (
                <> · {session.registeredParticipants.map((p) => `${p.firstName} ${p.lastName}`).join(", ")}</>
              ) : null}
            </p>
            <p className="muted text-sm">{session.presentCount} présent(s) saisi(s)</p>
          </div>
          <label className="space-y-1">
            <span className="text-xs font-medium">Statut comptable</span>
            <select
              className="input min-w-[12rem]"
              value={status}
              disabled={isFuture}
              onChange={(event) =>
                updateSessionStatus(session.id, event.target.value as BillingAccountingStatus)
              }
            >
              {(Object.keys(ACCOUNTING_STATUS_LABELS) as BillingAccountingStatus[]).map((value) => (
                <option key={value} value={value} disabled={value === "future" && !isFuture}>
                  {ACCOUNTING_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block space-y-1">
          <span className="text-xs font-medium">Commentaire (optionnel)</span>
          <input
            className="input"
            placeholder="Ex. : séance maintenue malgré la pluie"
            value={sessionComments[session.id] ?? ""}
            onChange={(event) =>
              setSessionComments((current) => ({ ...current, [session.id]: event.target.value }))
            }
          />
        </label>
      </article>
    );
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
              ? "Vous êtes connectée en mode coach (Manon). Déconnectez-vous puis reconnectez-vous avec le PIN responsable PPG (Suzanne)."
              : "Connectez-vous d'abord sur la page Admin avec le PIN responsable PPG."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin" className="btn btn-primary">
              Aller à l&apos;admin
            </Link>
            {role === "admin" ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await fetch("/api/admin", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "logout" }),
                  });
                  window.location.href = "/admin";
                }}
              >
                Se déconnecter
              </button>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  const treasurersCount = recipientsByType.treasurer.length;

  return (
    <div className="container max-w-3xl space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Facturation PPG</h1>
            <p className="muted mt-2 text-sm">
              Les adhérents s&apos;inscrivent seuls en ligne. Suzanne ne crée pas les inscriptions : elle marque
              seulement les présences le jeudi soir, puis valide le mois ici.
            </p>
          </div>
          <Link href="/admin" className="btn btn-secondary">
            Admin coach
          </Link>
        </div>
        {!brevoConfigured ? (
          <p className="mt-4 rounded-lg border border-[var(--warn)] bg-[#fff3cd] px-3 py-2 text-sm text-[#856404]">
            Brevo n&apos;est pas encore configuré sur Vercel.
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-bold">Adhérents à jour (adhésion payée)</h2>
        <p className="muted mt-2 text-sm">
          Importez la liste des membres du club. Seules ces personnes pourront créer un profil PPG. Format : une ligne
          par personne, « Prénom Nom » ou « Prénom;Nom » (CSV).
        </p>
        {paidMembers.length === 0 ? (
          <p className="mt-3 rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            Liste vide : les inscriptions publiques sont bloquées tant que cette liste n&apos;est pas importée.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={importMode === "replace"} onChange={() => setImportMode("replace")} />
            Remplacer la liste
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={importMode === "merge"} onChange={() => setImportMode("merge")} />
            Ajouter à la liste
          </label>
        </div>
        <textarea
          className="input mt-3 min-h-40 font-mono text-sm"
          placeholder={"Suzanne Huss\nPhilippe Lacues\nMarina;Dupont"}
          value={importRaw}
          onChange={(event) => setImportRaw(event.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={importMembers} disabled={busy || !importRaw.trim()}>
            Importer
          </button>
          <button type="button" className="btn btn-danger" onClick={clearMembers} disabled={busy || paidMembers.length === 0}>
            Vider la liste
          </button>
          <span className="muted self-center text-sm">
            {paidMembers.length} membre{paidMembers.length > 1 ? "s" : ""}
          </span>
        </div>
        {paidMembers.length > 0 ? (
          <ul className="mt-4 max-h-48 overflow-auto rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
            {paidMembers.map((member) => (
              <li key={member.id} className="px-3 py-2 text-sm">
                {member.firstName} {member.lastName}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {RECIPIENT_SECTIONS.map((section) => (
        <section key={section.type} className="card p-6">
          <h2 className="text-xl font-bold">{section.title}</h2>
          <p className="muted mt-2 text-sm">{section.hint}</p>
          <ul className="mt-4 space-y-2">
            {recipientsByType[section.type].length === 0 ? (
              <li className="muted text-sm">Aucun e-mail configuré.</li>
            ) : (
              recipientsByType[section.type].map((recipient) => (
                <li
                  key={recipient.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bg)] px-3 py-2"
                >
                  <span>
                    {recipient.email}
                    {recipient.label ? <span className="muted text-sm"> · {recipient.label}</span> : null}
                  </span>
                  <button type="button" className="btn btn-danger text-xs" onClick={() => removeRecipient(recipient.id)}>
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
              placeholder="E-mail"
              value={newEmails[section.type].email}
              onChange={(event) =>
                setNewEmails((current) => ({
                  ...current,
                  [section.type]: { ...current[section.type], email: event.target.value },
                }))
              }
            />
            <input
              className="input min-w-[10rem]"
              placeholder="Libellé (optionnel)"
              value={newEmails[section.type].label}
              onChange={(event) =>
                setNewEmails((current) => ({
                  ...current,
                  [section.type]: { ...current[section.type], label: event.target.value },
                }))
              }
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !newEmails[section.type].email.trim()}
              onClick={() => addRecipient(section.type)}
            >
              Ajouter
            </button>
          </div>
        </section>
      ))}

      <section className="card p-6">
        <h2 className="text-xl font-bold">Valider les cours du mois</h2>
        <p className="muted mt-2 text-sm">
          Pour chaque séance, le statut est pré-rempli automatiquement. Vous pouvez le corriger avant validation.
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
                      Validé · envoyé {validation.sendCount} fois · {validation.billedSessionCount} séance(s) facturée(s)
                    </p>
                  ) : (
                    <p className="muted text-sm">Pas encore validé</p>
                  )}
                </div>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => openPreview(monthKey)}>
                  {validation?.lastSentAt ? "Modifier / renvoyer" : "Valider"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {preview && previewMonthKey ? (
        <section className="card p-6">
          <h2 className="text-xl font-bold capitalize">Validation — {preview.monthLabel}</h2>

          {!preview.canValidate ? (
            <p className="mt-4 rounded-lg border border-[var(--warn)] bg-[#fff3cd] px-3 py-2 text-sm text-[#856404]">
              Ce mois contient encore des séances à venir. Revenez après le dernier jeudi.
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            {preview.sessions.map((session) => renderSessionRow(session))}
          </div>

          <p className="mt-4 text-sm">
            Calcul automatique : <strong>{countBillable(sessionStatuses)}</strong> séance(s) facturable(s)
          </p>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium">Nombre de séances pour la facturation (correction manuelle)</span>
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
              value={billingNote}
              onChange={(event) => setBillingNote(event.target.value)}
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !preview.canValidate || treasurersCount === 0 || !brevoConfigured}
              onClick={sendValidation}
            >
              {preview.lastValidation?.lastSentAt ? "Valider et renvoyer" : "Valider et envoyer"}
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
