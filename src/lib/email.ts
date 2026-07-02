import {
  buildBrandedEmailHtml,
  emailParagraph,
  emailStrong,
  escapeHtml,
} from "@/lib/email-template";
import { getAppUrl } from "@/lib/auth";

export function isBrevoConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

function unsubscribeLink(accessToken: string) {
  return `${getAppUrl().replace(/\/$/, "")}/desabonnement/${accessToken}`;
}

export async function sendBillingValidationEmail(input: {
  to: string[];
  cc?: string[];
  monthLabel: string;
  billedSessionCount: number;
  computedSessionCount: number;
  billingNote: string | null;
  pdfBytes: Uint8Array;
  filename: string;
  isResend: boolean;
}) {
  if (!isBrevoConfigured()) {
    throw new Error("BREVO_NOT_CONFIGURED");
  }

  const senderName = process.env.BREVO_SENDER_NAME ?? "PPG Courir à Sausset";
  const senderEmail = process.env.BREVO_SENDER_EMAIL!;

  const correctionLine =
    input.billedSessionCount !== input.computedSessionCount
      ? emailParagraph(
          `Correction : ${emailStrong(String(input.billedSessionCount))} séance(s) facturée(s) (calcul auto : ${input.computedSessionCount}).`,
        )
      : emailParagraph(`${emailStrong(String(input.billedSessionCount))} séance(s) facturée(s).`);

  const noteLine = input.billingNote?.trim()
    ? emailParagraph(`Note : ${escapeHtml(input.billingNote.trim())}`)
    : "";

  const resendLine = input.isResend ? emailParagraph("<em>Nouvel envoi (mise à jour).</em>") : "";

  const htmlContent = buildBrandedEmailHtml({
    preheader: `Cours validés — ${input.monthLabel}`,
    title: `Cours validés — ${input.monthLabel}`,
    badge: { text: "Facturation", tone: "accent" },
    bodyHtml: [
      emailParagraph("Bonjour,"),
      emailParagraph(`Suzanne a validé les cours PPG de ${emailStrong(input.monthLabel)}.`),
      correctionLine,
      noteLine,
      resendLine,
      emailParagraph("Le détail est en pièce jointe (PDF)."),
    ].join(""),
    signature: "PPG Courir à Sausset",
  });

  await postBrevoEmail({
    sender: { name: senderName, email: senderEmail },
    to: input.to.map((email) => ({ email })),
    cc: (input.cc ?? []).map((email) => ({ email })),
    subject: `PPG Sausset — Cours validés — ${input.monthLabel}`,
    htmlContent,
    attachment: [
      {
        name: input.filename,
        content: Buffer.from(input.pdfBytes).toString("base64"),
      },
    ],
  });
}

export async function sendValidationReminderEmail(input: {
  to: string[];
  monthLabel: string;
  appUrl: string;
}) {
  if (!isBrevoConfigured()) {
    throw new Error("BREVO_NOT_CONFIGURED");
  }

  const senderName = process.env.BREVO_SENDER_NAME ?? "PPG Courir à Sausset";
  const senderEmail = process.env.BREVO_SENDER_EMAIL!;
  const facturationUrl = `${input.appUrl.replace(/\/$/, "")}/admin/facturation`;

  const htmlContent = buildBrandedEmailHtml({
    preheader: `À valider : ${input.monthLabel}`,
    title: "Validation mensuelle",
    badge: { text: "Rappel", tone: "warn" },
    bodyHtml: [
      emailParagraph("Bonjour Suzanne,"),
      emailParagraph(`La dernière séance PPG de ${emailStrong(input.monthLabel)} est terminée.`),
      emailParagraph("Vous pouvez valider le mois et envoyer le récapitulatif aux trésoriers."),
    ].join(""),
    cta: { label: "Ouvrir la facturation", href: facturationUrl },
    signature: "PPG Courir à Sausset",
  });

  await postBrevoEmail({
    sender: { name: senderName, email: senderEmail },
    to: input.to.map((email) => ({ email })),
    subject: `PPG Sausset — À valider : ${input.monthLabel}`,
    htmlContent,
  });
}

export async function sendSessionNotMaintainedEmail(input: {
  to: string;
  cc: string[];
  firstName: string;
  sessionDateLabel: string;
  status: "cancelled" | "rescheduled";
  theme: string | null;
  notes: string | null;
  accessToken?: string;
}) {
  if (!isBrevoConfigured()) {
    throw new Error("BREVO_NOT_CONFIGURED");
  }

  const senderName = process.env.BREVO_SENDER_NAME ?? "PPG Courir à Sausset";
  const senderEmail = process.env.BREVO_SENDER_EMAIL!;
  const statusLabel = input.status === "cancelled" ? "annulée" : "reportée";
  const appUrl = getAppUrl().replace(/\/$/, "");

  const themeLine = input.theme?.trim() ? emailParagraph(`Thème : ${escapeHtml(input.theme.trim())}`) : "";
  const notesLine = input.notes?.trim() ? emailParagraph(`Précisions : ${escapeHtml(input.notes.trim())}`) : "";

  const htmlContent = buildBrandedEmailHtml({
    preheader: `Séance ${statusLabel} — ${input.sessionDateLabel}`,
    title: `Séance ${statusLabel}`,
    badge: {
      text: input.status === "cancelled" ? "Annulée" : "Reportée",
      tone: input.status === "cancelled" ? "danger" : "warn",
    },
    bodyHtml: [
      emailParagraph(`Bonjour ${escapeHtml(input.firstName)},`),
      emailParagraph(`La séance PPG du ${emailStrong(input.sessionDateLabel)} est ${emailStrong(statusLabel)}.`),
      themeLine,
      notesLine,
      emailParagraph("Vous n'avez pas besoin de vous déplacer pour cette date."),
    ].join(""),
    cta: { label: "Voir le calendrier", href: appUrl },
    footerLinks: input.accessToken
      ? [{ label: "Gérer mes e-mails", href: unsubscribeLink(input.accessToken) }]
      : undefined,
    signature: "Manon — PPG Courir à Sausset",
  });

  await postBrevoEmail({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: input.to }],
    cc: input.cc.map((email) => ({ email })),
    subject: `PPG Sausset — Séance ${statusLabel} — ${input.sessionDateLabel}`,
    htmlContent,
  });
}

export async function sendSessionReminderEmail(input: {
  to: string;
  firstName: string;
  sessionDateLabel: string;
  timeLabel: string;
  location: string;
  theme: string | null;
  accessToken: string;
  sessionId: string;
}) {
  if (!isBrevoConfigured()) {
    throw new Error("BREVO_NOT_CONFIGURED");
  }

  const senderName = process.env.BREVO_SENDER_NAME ?? "PPG Courir à Sausset";
  const senderEmail = process.env.BREVO_SENDER_EMAIL!;
  const appUrl = getAppUrl().replace(/\/$/, "");
  const sessionUrl = `${appUrl}/seance/${input.sessionId}`;

  const themeLine = input.theme?.trim() ? emailParagraph(`Thème : ${escapeHtml(input.theme.trim())}`) : "";

  const htmlContent = buildBrandedEmailHtml({
    preheader: `Rappel — séance demain ${input.timeLabel}`,
    title: "Rappel — séance demain",
    badge: { text: "Demain", tone: "accent" },
    bodyHtml: [
      emailParagraph(`Bonjour ${escapeHtml(input.firstName)},`),
      emailParagraph(
        `Vous êtes inscrit(e) à la séance PPG de ${emailStrong(input.sessionDateLabel)} (${emailStrong(input.timeLabel)}, ${escapeHtml(input.location)}).`,
      ),
      themeLine,
      emailParagraph("À demain sur le terrain !"),
    ].join(""),
    cta: { label: "Voir la séance", href: sessionUrl },
    footerLinks: [
      { label: "Ne plus recevoir les rappels", href: unsubscribeLink(input.accessToken) },
      { label: "Calendrier PPG", href: appUrl },
    ],
    signature: "PPG Courir à Sausset",
  });

  await postBrevoEmail({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: input.to }],
    subject: `PPG Sausset — Rappel séance demain (${input.sessionDateLabel})`,
    htmlContent,
  });
}

async function postBrevoEmail(body: Record<string, unknown>) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BREVO_SEND_FAILED:${response.status}:${text}`);
  }
}
