import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ACCOUNTING_STATUS_LABELS } from "@/lib/billing";
import { formatParisDate, formatTimeLabel } from "@/lib/calendar";
import type { BillingSessionSnapshot, Season } from "@/lib/types";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;

function sanitizePdfText(text: string) {
  return text
    .normalize("NFC")
    .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, (char) => {
      const map: Record<string, string> = {
        œ: "oe",
        Œ: "OE",
        æ: "ae",
        Æ: "AE",
      };
      return map[char] ?? "?";
    });
}

export async function buildBillingValidationPdf(input: {
  season: Season;
  monthLabel: string;
  computedSessionCount: number;
  billedSessionCount: number;
  billingNote: string | null;
  realizedSessions: BillingSessionSnapshot[];
  allSessions: BillingSessionSnapshot[];
}) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN + 24) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawLine(text: string, options?: { size?: number; bold?: boolean; indent?: number }) {
    const size = options?.size ?? 11;
    const usedFont = options?.bold ? fontBold : font;
    const x = MARGIN + (options?.indent ?? 0);
    ensureSpace(size + 6);
    page.drawText(sanitizePdfText(text), {
      x,
      y,
      size,
      font: usedFont,
      color: rgb(0.12, 0.12, 0.12),
    });
    y -= size + 6;
  }

  drawLine("PPG Courir à Sausset", { size: 16, bold: true });
  drawLine(`Validation facturation — ${input.monthLabel}`, { size: 13, bold: true });
  drawLine(
    `Saison ${input.season.label} · ${formatTimeLabel(input.season.startTime)}–${formatTimeLabel(input.season.endTime)} · ${input.season.location}`,
    { size: 10 },
  );
  y -= 6;
  drawLine(`Séances réalisées (calcul) : ${input.computedSessionCount}`, { size: 11, bold: true });
  drawLine(`Séances facturées : ${input.billedSessionCount}`, { size: 12, bold: true });
  if (input.billingNote?.trim()) {
    drawLine(`Note : ${input.billingNote.trim()}`, { size: 10 });
  }
  y -= 8;

  drawLine("Récapitulatif du mois", { size: 11, bold: true });
  for (const session of input.allSessions) {
    if (session.accountingStatus === "future") {
      continue;
    }
    drawLine(
      `${formatParisDate(session.sessionDate)} — ${ACCOUNTING_STATUS_LABELS[session.accountingStatus]}`,
      { size: 10, indent: 8 },
    );
  }
  y -= 8;

  const totalPresences = input.realizedSessions.reduce((sum, session) => sum + session.presentCount, 0);
  drawLine(`Détail des ${input.realizedSessions.length} séance(s) facturable(s) · ${totalPresences} présence(s)`, {
    size: 10,
    bold: true,
  });

  for (const session of input.realizedSessions) {
    ensureSpace(60);
    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= 14;

    drawLine(formatParisDate(session.sessionDate), { size: 12, bold: true });
    if (session.theme?.trim()) {
      drawLine(`Thème : ${session.theme.trim()}`, { size: 10, indent: 8 });
    }
    if (session.comment?.trim()) {
      drawLine(`Commentaire : ${session.comment.trim()}`, { size: 10, indent: 8 });
    }
    drawLine(
      `${session.registeredCount} inscrit(s) en ligne · ${session.presentCount} présent(s)`,
      { size: 10, indent: 8 },
    );

    if (session.presentParticipants.length === 0) {
      drawLine("Aucun présent enregistré.", { size: 10, indent: 16 });
    } else {
      for (const [index, participant] of session.presentParticipants.entries()) {
        drawLine(`${index + 1}. ${participant.firstName} ${participant.lastName}`, { size: 10, indent: 16 });
      }
    }
    y -= 6;
  }

  const generatedAt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  ensureSpace(16);
  page.drawText(sanitizePdfText(`Généré le ${generatedAt}`), {
    x: MARGIN,
    y: MARGIN,
    size: 8,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });

  return pdfDoc.save();
}
