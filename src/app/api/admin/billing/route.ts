import { NextResponse } from "next/server";
import { isSuperAdminAuthenticated } from "@/lib/auth";
import { isBrevoConfigured } from "@/lib/email";
import {
  addTreasurerEmail,
  getActiveSeason,
  getMonthBillingPreview,
  listMonthValidations,
  listTreasurerEmails,
  removeTreasurerEmail,
  saveAndSendMonthValidation,
} from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

async function requireSuperAdmin() {
  if (!(await isSuperAdminAuthenticated())) {
    return NextResponse.json({ error: "Accès réservé à la responsable PPG." }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const denied = await requireSuperAdmin();
  if (denied) {
    return denied;
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "config") {
    return NextResponse.json({
      brevoConfigured: isBrevoConfigured(),
      senderEmail: process.env.BREVO_SENDER_EMAIL ?? null,
    });
  }

  if (action === "treasurers") {
    const treasurers = await listTreasurerEmails();
    return NextResponse.json({ treasurers });
  }

  if (action === "validations") {
    const season = await getActiveSeason();
    if (!season) {
      return NextResponse.json({ season: null, validations: [] });
    }
    const validations = await listMonthValidations(season.id);
    return NextResponse.json({ season, validations });
  }

  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Année ou mois invalide." }, { status: 400 });
  }

  try {
    const preview = await getMonthBillingPreview(year, month - 1);
    return NextResponse.json({ preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur";
    if (message === "NO_SEASON") {
      return NextResponse.json({ error: "Aucune saison active." }, { status: 400 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const denied = await requireSuperAdmin();
  if (denied) {
    return denied;
  }

  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "treasurers.add") {
    try {
      const treasurer = await addTreasurerEmail(String(body.email ?? ""), body.label ? String(body.label) : null);
      const treasurers = await listTreasurerEmails();
      return NextResponse.json({ treasurer, treasurers });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur";
      if (message === "INVALID_EMAIL") {
        return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
      }
      throw error;
    }
  }

  if (action === "treasurers.remove") {
    const id = String(body.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
    }
    await removeTreasurerEmail(id);
    const treasurers = await listTreasurerEmails();
    return NextResponse.json({ treasurers });
  }

  if (action === "send") {
    const year = Number(body.year);
    const month = Number(body.month);
    const billedSessionCount = Number(body.billedSessionCount);
    const billingNote = body.billingNote ? String(body.billingNote) : null;
    const sendEmail = body.sendEmail !== false;

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Année ou mois invalide." }, { status: 400 });
    }

    if (!isBrevoConfigured() && sendEmail) {
      return NextResponse.json(
        { error: "Brevo n'est pas configuré. Ajoutez BREVO_API_KEY et BREVO_SENDER_EMAIL sur Vercel." },
        { status: 503 },
      );
    }

    try {
      const result = await saveAndSendMonthValidation({
        year,
        monthIndex: month - 1,
        billedSessionCount,
        billingNote,
        sendEmail,
      });
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur";
      if (message === "BLOCKING_ISSUES") {
        return NextResponse.json(
          { error: "Des présences sont incomplètes. Complétez les feuilles de présence avant validation." },
          { status: 400 },
        );
      }
      if (message === "NO_TREASURERS") {
        return NextResponse.json({ error: "Ajoutez au moins un e-mail trésorier." }, { status: 400 });
      }
      if (message === "INVALID_BILLED_COUNT") {
        return NextResponse.json({ error: "Nombre de séances facturées invalide." }, { status: 400 });
      }
      if (message === "BREVO_NOT_CONFIGURED") {
        return NextResponse.json({ error: "Brevo non configuré." }, { status: 503 });
      }
      if (message.startsWith("BREVO_SEND_FAILED")) {
        return NextResponse.json({ error: "L'envoi Brevo a échoué. Vérifiez la configuration." }, { status: 502 });
      }
      throw error;
    }
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
