import { getAppUrl } from "@/lib/auth";

const BRAND = {
  accent: "#2d6a4f",
  accentDark: "#1b4332",
  accentSoft: "#e8f5e9",
  ink: "#1a2e1a",
  muted: "#5c6b5c",
  bg: "#f6f8f5",
  card: "#ffffff",
  border: "#dde5dd",
  danger: "#9b2226",
  dangerSoft: "#fdecea",
  warn: "#bc6c25",
  warnSoft: "#fff8e6",
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
  footerLinks?: Array<{ label: string; href: string }>;
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
    ? `<p style="margin:0 0 20px;">
        <span style="display:inline-block;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;background:${badgeColors[input.badge.tone].bg};color:${badgeColors[input.badge.tone].text};">
          ${escapeHtml(input.badge.text)}
        </span>
       </p>`
    : "";

  const ctaHtml = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 4px;">
        <tr>
          <td style="border-radius:8px;background:${BRAND.accent};">
            <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
              ${escapeHtml(input.cta.label)}
            </a>
          </td>
        </tr>
       </table>`
    : "";

  const footerLinksHtml =
    input.footerLinks && input.footerLinks.length > 0
      ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.8;color:${BRAND.muted};">
          ${input.footerLinks
            .map(
              (link) =>
                `<a href="${escapeHtml(link.href)}" style="color:${BRAND.accent};text-decoration:none;">${escapeHtml(link.label)}</a>`,
            )
            .join(" · ")}
         </p>`
      : `<p style="margin:16px 0 0;font-size:12px;color:${BRAND.muted};">
          <a href="${escapeHtml(appUrl)}" style="color:${BRAND.accent};text-decoration:none;">Calendrier PPG</a>
         </p>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:${BRAND.bg};">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;">
          <tr>
            <td style="padding:28px 28px 0;text-align:center;">
              <img src="${escapeHtml(logoUrl)}" alt="PPG Courir à Sausset" width="64" height="64" style="display:block;margin:0 auto 12px;border:0;" />
              <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.accent};letter-spacing:0.04em;text-transform:uppercase;">PPG Courir à Sausset</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 28px;">
              <h1 style="margin:0 0 8px;font-size:20px;line-height:1.35;font-weight:700;color:${BRAND.ink};">${escapeHtml(input.title)}</h1>
              ${badgeHtml}
              <div style="font-size:15px;line-height:1.65;color:${BRAND.ink};">
                ${input.bodyHtml}
              </div>
              ${ctaHtml}
              <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid ${BRAND.border};font-size:14px;line-height:1.5;color:${BRAND.muted};">
                Cordialement,<br />
                <span style="color:${BRAND.ink};font-weight:600;">${escapeHtml(signature)}</span>
              </p>
              ${footerLinksHtml}
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
  return `<p style="margin:0 0 16px;">${text}</p>`;
}

export function emailStrong(text: string) {
  return `<strong style="color:${BRAND.accentDark};">${escapeHtml(text)}</strong>`;
}
