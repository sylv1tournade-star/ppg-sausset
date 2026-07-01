import fs from "fs";
import path from "path";
import type { PDFDocument, PDFPage } from "pdf-lib";

let cachedLogoBytes: Uint8Array | null = null;

export function sanitizePdfText(text: string) {
  return text
    .normalize("NFC")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00B7/g, " - ")
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

function loadLogoBytes() {
  if (!cachedLogoBytes) {
    cachedLogoBytes = fs.readFileSync(path.join(process.cwd(), "public", "ppg-logo.png"));
  }
  return cachedLogoBytes;
}

export async function drawPpgPdfLogo(
  pdfDoc: PDFDocument,
  page: PDFPage,
  x: number,
  yTop: number,
  maxWidth = 64,
) {
  const image = await pdfDoc.embedPng(loadLogoBytes());
  const scale = maxWidth / image.width;
  const height = image.height * scale;
  page.drawImage(image, {
    x,
    y: yTop - height,
    width: maxWidth,
    height,
  });
  return { height, bottom: yTop - height };
}

export function formatPdfEditionDate(date = new Date()) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}
