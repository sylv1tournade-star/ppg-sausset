import { NextResponse } from "next/server";
import { isSuperAdminAuthenticated } from "@/lib/auth";
import { buildMonthRegistrationsPdf } from "@/lib/month-export-pdf";
import { getMonthRegistrationsReport } from "@/lib/server-data";
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

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Année ou mois invalide." }, { status: 400 });
  }

  try {
    const report = await getMonthRegistrationsReport(year, month - 1);
    const pdfBytes = await buildMonthRegistrationsPdf(report);
    const filename = `ppg-inscriptions-${year}-${String(month).padStart(2, "0")}.pdf`;

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
