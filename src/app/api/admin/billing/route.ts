import { NextResponse } from "next/server";
import { isSuperAdminAuthenticated } from "@/lib/auth";
import { isBrevoConfigured } from "@/lib/email";
import {
  addBillingRecipient,
  getActiveSeason,
  getMonthBillingPreview,
  listBillingRecipients,
  listMonthValidations,
  removeBillingRecipient,
  saveAndSendMonthValidation,
} from "@/lib/server-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { BillingAccountingStatus, BillingRecipientType } from "@/lib/types";

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

  if (action === "recipients") {
    const recipients = await listBillingRecipients();
    return NextResponse.json({ recipients });
  }

  if (action === "treasurers") {
    const treasurers = await listBillingRecipients("treasurer");
    return NextResponse.json({ treasurers, recipients: await listBillingRecipients() });
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

  if (action === "recipients.add" || action === "treasurers.add") {
    try {
      const recipientType = (body.recipientType ? String(body.recipientType) : "treasurer") as BillingRecipientType;
      const recipient = await addBillingRecipient(
        String(body.email ?? ""),
        recipientType,
        body.label ? String(body.label) : null,
      );
      const recipients = await listBillingRecipients();
      return NextResponse.json({ recipient, recipients, treasurers: recipients.filter((r) => r.recipientType === "treasurer") });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur";
      if (message === "INVALID_EMAIL") {
        return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
      }
      throw error;
    }
  }

  if (action === "recipients.remove" || action === "treasurers.remove") {
    const id = String(body.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
    }
    await removeBillingRecipient(id);
    const recipients = await listBillingRecipients();
    return NextResponse.json({ recipients, treasurers: recipients.filter((r) => r.recipientType === "treasurer") });
  }

  if (action === "send") {
    const year = Number(body.year);
    const month = Number(body.month);
    const billedSessionCount = Number(body.billedSessionCount);
    const billingNote = body.billingNote ? String(body.billingNote) : null;
    const sendEmail = body.sendEmail !== false;
    const sessionStatuses = Array.isArray(body.sessionStatuses)
      ? (body.sessionStatuses as Array<{ sessionId: string; accountingStatus: BillingAccountingStatus }>)
      : [];

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
        sessionStatuses,
        sendEmail,
      });
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur";
      if (message === "FUTURE_SESSIONS") {
        return NextResponse.json(
          { error: "Le mois contient encore des séances à venir. Attendez la fin du dernier jeudi." },
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
