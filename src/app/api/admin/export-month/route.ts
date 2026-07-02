import { NextResponse } from "next/server";
import { isSuperAdminAuthenticated } from "@/lib/auth";
import { buildMonthPresenceCsv, buildMonthRegistrationsCsv } from "@/lib/month-export-csv";
import { buildMonthRegistrationsPdf } from "@/lib/month-export-pdf";
import { getMonthPresenceExport, getMonthRegistrationsReport } from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  if (!(await isSuperAdminAuthenticated())) {
    return NextResponse.json({ error: "Accès réservé à la responsable PPG." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const format = searchParams.get("format") ?? "pdf";

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Année ou mois invalide." }, { status: 400 });
  }

  try {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    if (format === "csv") {
      const report = await getMonthRegistrationsReport(year, month - 1);
      const csv = buildMonthRegistrationsCsv({
        monthLabel: report.monthLabel,
        sessions: report.sessions.map((session) => ({
          sessionDate: session.sessionDate,
          theme: session.theme,
          status: session.status,
          participants: session.participants ?? [],
        })),
      });
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ppg-inscriptions-${monthKey}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "csv-presence") {
      const exportData = await getMonthPresenceExport(year, month - 1);
      const csv = buildMonthPresenceCsv(exportData);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ppg-presences-${monthKey}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const report = await getMonthRegistrationsReport(year, month - 1);
    const pdfBytes = await buildMonthRegistrationsPdf(report);
    const filename = `ppg-inscriptions-${monthKey}.pdf`;

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur";
    if (message === "NO_SEASON") {
      return NextResponse.json({ error: "Aucune saison active." }, { status: 400 });
    }
    throw error;
  }
}
