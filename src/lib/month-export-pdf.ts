import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatMonthYear, formatParisDate, formatTimeLabel, toMonthKey } from "@/lib/calendar";
import type { Season, SessionWithMeta } from "@/lib/types";

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

export type MonthRegistrationsReport = {
  season: Season;
  monthLabel: string;
  year: number;
  month: number;
  sessions: SessionWithMeta[];
};

export async function buildMonthRegistrationsPdf(report: MonthRegistrationsReport) {
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
  drawLine(`Édition des inscriptions — ${report.monthLabel}`, { size: 13, bold: true });
  drawLine(
    `Saison ${report.season.label} · ${formatTimeLabel(report.season.startTime)}–${formatTimeLabel(report.season.endTime)} · ${report.season.location}`,
    { size: 10 },
  );
  y -= 8;

  const sessions = [...report.sessions].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

  if (sessions.length === 0) {
    drawLine("Aucune séance ce mois-ci.");
  }

  for (const session of sessions) {
    ensureSpace(72);
    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= 14;

    const statusSuffix =
      session.status === "cancelled"
        ? " — Annulée"
        : session.status === "rescheduled"
          ? " — Reportée"
          : "";

    drawLine(`${formatParisDate(session.sessionDate)}${statusSuffix}`, { size: 12, bold: true });

    if (session.theme?.trim()) {
      drawLine(`Thème : ${session.theme.trim()}`, { size: 10, indent: 8 });
    }

    if (session.notes?.trim()) {
      drawLine(`Notes : ${session.notes.trim()}`, { size: 10, indent: 8 });
    }

    const count = session.registrationCount ?? session.participants?.length ?? 0;
    drawLine(`${count} inscrit${count > 1 ? "s" : ""}`, { size: 10, indent: 8 });

    const participants = session.participants ?? [];
    if (participants.length === 0) {
      drawLine("Aucune inscription.", { size: 10, indent: 16 });
    } else {
      for (const [index, participant] of participants.entries()) {
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

export function monthKeyFromParts(year: number, monthIndex: number) {
  return toMonthKey(year, monthIndex);
}

export function monthLabelFromParts(year: number, monthIndex: number) {
  return formatMonthYear(year, monthIndex);
}
