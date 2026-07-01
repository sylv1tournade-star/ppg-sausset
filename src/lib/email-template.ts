import { getAppUrl } from "@/lib/auth";

const BRAND = {
  accent: "#2d6a4f",
  accentDark: "#1b4332",
  accentSoft: "#d8f3dc",
  ink: "#1a2e1a",
  muted: "#5c6b5c",
  bg: "#f4f7f2",
  card: "#ffffff",
  border: "#d8e2d8",
  danger: "#9b2226",
  dangerSoft: "#f8d7da",
  warn: "#bc6c25",
  warnSoft: "#fff3cd",
};

export type EmailBadgeTone = "accent" | "danger" | "warn";

export function getEmailLogoUrl() {
  return `${getAppUrl().replace(/\/$/, "")}/ppg-logo.png`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildBrandedEmailHtml(input: {
  preheader?: string;
  title: string;
  badge?: { text: string; tone: EmailBadgeTone };
  bodyHtml: string;
  cta?: { label: string; href: string };
  signature?: string;
}) {
  const logoUrl = getEmailLogoUrl();
  const appUrl = getAppUrl().replace(/\/$/, "");
  const preheader = input.preheader ?? input.title;
  const signature = input.signature ?? "PPG Courir à Sausset";

  const badgeColors: Record<EmailBadgeTone, { bg: string; text: string }> = {
    accent: { bg: BRAND.accentSoft, text: BRAND.accent },
    danger: { bg: BRAND.dangerSoft, text: BRAND.danger },
    warn: { bg: BRAND.warnSoft, text: BRAND.warn },
  };

  const badgeHtml = input.badge
    ? `<p style="margin:0 0 16px;">
        <span style="display:inline-block;padding:6px 12px;border-radius:999px;font-size:13px;font-weight:700;background:${badgeColors[input.badge.tone].bg};color:${badgeColors[input.badge.tone].text};">
          ${escapeHtml(input.badge.text)}
        </span>
       </p>`
    : "";

  const ctaHtml = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
        <tr>
          <td style="border-radius:999px;background:${BRAND.accent};">
            <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
              ${escapeHtml(input.cta.label)}
            </a>
          </td>
        </tr>
       </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Segoe UI,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:0;padding:24px 12px;background:${BRAND.bg};">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 24px 16px;text-align:center;background:linear-gradient(180deg,${BRAND.accentSoft} 0%,${BRAND.card} 100%);border-bottom:1px solid ${BRAND.border};">
              <a href="${escapeHtml(appUrl)}" style="text-decoration:none;">
                <img src="${escapeHtml(logoUrl)}" alt="PPG Courir à Sausset" width="88" height="88" style="display:block;margin:0 auto 12px;border:0;" />
              </a>
              <p style="margin:0;font-size:18px;font-weight:700;color:${BRAND.accent};">PPG Courir à Sausset</p>
              <p style="margin:6px 0 0;font-size:13px;color:${BRAND.muted};">Jeudi 19h — préparation physique</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${BRAND.ink};">${escapeHtml(input.title)}</h1>
              ${badgeHtml}
              <div style="font-size:15px;line-height:1.6;color:${BRAND.ink};">
                ${input.bodyHtml}
              </div>
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px;">
              <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid ${BRAND.border};font-size:14px;line-height:1.5;color:${BRAND.muted};">
                Cordialement,<br />
                <strong style="color:${BRAND.ink};">${escapeHtml(signature)}</strong>
              </p>
              <p style="margin:16px 0 0;font-size:12px;color:${BRAND.muted};">
                <a href="${escapeHtml(appUrl)}" style="color:${BRAND.accent};text-decoration:none;">Voir le calendrier PPG</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function emailParagraph(text: string) {
  return `<p style="margin:0 0 14px;">${text}</p>`;
}

export function emailStrong(text: string) {
  return `<strong style="color:${BRAND.accentDark};">${escapeHtml(text)}</strong>`;
}
