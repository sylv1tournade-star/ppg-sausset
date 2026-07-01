export function isBrevoConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

export async function sendBillingValidationEmail(input: {
  to: string[];
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
      ? `<p><strong>Correction facturation :</strong> ${input.billedSessionCount} séance(s) facturée(s) (calcul automatique : ${input.computedSessionCount}).</p>`
      : `<p><strong>Nombre de séances facturées :</strong> ${input.billedSessionCount}.</p>`;

  const noteLine = input.billingNote?.trim()
    ? `<p><strong>Note :</strong> ${escapeHtml(input.billingNote.trim())}</p>`
    : "";

  const resendLine = input.isResend
    ? "<p><em>Ceci est un nouvel envoi (correction ou mise à jour).</em></p>"
    : "";

  const htmlContent = `
    <p>Bonjour,</p>
    <p>Suzanne a validé les cours PPG de <strong>${escapeHtml(input.monthLabel)}</strong>.</p>
    ${correctionLine}
    ${noteLine}
    ${resendLine}
    <p>Le détail des séances réalisées et des présences est en pièce jointe (PDF).</p>
    <p>Cordialement,<br/>PPG Courir à Sausset</p>
  `.trim();

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: input.to.map((email) => ({ email })),
      subject: `PPG Sausset — Cours validés — ${input.monthLabel}`,
      htmlContent,
      attachment: [
        {
          name: input.filename,
          content: Buffer.from(input.pdfBytes).toString("base64"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`BREVO_SEND_FAILED:${response.status}:${body}`);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
