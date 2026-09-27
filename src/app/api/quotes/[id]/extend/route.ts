import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendQuoteExtendedEmail } from "@/lib/email";
import { quoteExtensionDate } from "@/lib/quote-extension";

/**
 * Een verlopen of afgewezen offerte weer opengezet: nieuwe geldigheidsdatum,
 * status terug naar SENT, en de klant krijgt een mail met de portaallink.
 *
 * Handig bij een klant die "kom er op terug" zei en toen de offerte liet
 * verlopen. Er wordt een portaal-token aangemaakt als dat er nog niet is.
 */

const bodySchema = z.object({
  // Aantal dagen dat de offerte er weer bij krijgt, of een expliciete datum.
  days: z.number().int().min(1).max(180).optional(),
  validUntil: z.string().datetime().optional(),
  note: z.string().trim().max(2000).optional(),
  emailSubject: z.string().trim().min(1).max(180).refine((value) => !/[\r\n]/.test(value)).optional(),
  emailMessage: z.string().trim().min(1).max(2000).optional(),
  // Standaard sturen we de klant een mail. Uit te zetten voor een stille verlenging.
  notifyCustomer: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) {
    return NextResponse.json({ error: "Geen actief bedrijf" }, { status: 401 });
  }
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige aanvraag" }, { status: 400 });

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: { customer: true, company: true, share: true },
  });
  if (!quote) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  if (!["SENT", "VIEWED", "EXPIRED", "DECLINED"].includes(quote.status)) {
    return NextResponse.json({ error: "Deze offerte kan niet worden verlengd." }, { status: 409 });
  }
  if (parsed.data.notifyCustomer && !quote.customer.email) {
    return NextResponse.json({ error: "Deze klant heeft geen e-mailadres. Kies stil verlengen." }, { status: 422 });
  }

  const now = new Date();
  const newValidUntil = parsed.data.validUntil
    ? new Date(parsed.data.validUntil)
    : quoteExtensionDate(now, quote.validUntil, parsed.data.days ?? 14);
  if (newValidUntil <= (quote.validUntil && quote.validUntil > now ? quote.validUntil : now)) {
    return NextResponse.json({ error: "De nieuwe geldigheidsdatum moet later zijn dan de huidige." }, { status: 422 });
  }

  // Token aanmaken als die er nog niet is, zodat de mail meteen een link heeft.
  const share = await prisma.quoteShare.upsert({
    where: { quoteId: id },
    create: { quoteId: id },
    update: {},
  });

  const previousStatus = quote.status;

  await prisma.$transaction([
    prisma.quote.update({
      where: { id },
      data: {
        validUntil: newValidUntil,
        // Terug naar SENT zodat hij weer in de opvolglijst staat en niet als
        // "verlopen" of "afgewezen" blijft hangen.
        status: "SENT",
      },
    }),
    prisma.quoteEvent.create({
      data: {
        quoteId: id,
        type: "EXTENDED",
        actor: session.user.name ?? "onbekend",
        detail: `Verlengd tot ${newValidUntil.toLocaleDateString("nl-NL")} (was ${previousStatus})${
          parsed.data.note ? ` — ${parsed.data.note}` : ""
        }`,
      },
    }),
  ]);

  const appUrl = req.nextUrl.origin;
  const portalUrl = `${appUrl}/q/${share.token}`;
  let mailSent = false;
  let mailError: string | null = null;

  if (parsed.data.notifyCustomer && quote.customer.email) {
    const result = await sendQuoteExtendedEmail({
      to: quote.customer.email,
      companySlug: quote.company.slug,
      customerName: quote.customer.name,
      quoteNumber: quote.number,
      quoteTitle: quote.title,
      validUntil: newValidUntil,
      portalUrl,
      note: parsed.data.note,
      subject: parsed.data.emailSubject,
      message: parsed.data.emailMessage,
    }).catch((error) => {
      console.error("[QUOTE EXTEND] mail mislukt", error);
      return { sent: false as const, reason: "E-mail verzenden mislukt" };
    });
    mailSent = result.sent === true;
    if (!mailSent) mailError = result.reason ?? "E-mail verzenden mislukt";
    if (mailSent) {
      after(async () => {
        const { sendTelegramMessage } = await import("@/lib/notifications");
        await sendTelegramMessage(
          `📤 <b>Offerte verlengd</b>\n📄 ${quote.number} — ${quote.customer.name}\n📅 Geldig tot ${newValidUntil.toLocaleDateString("nl-NL")}\nKlant heeft een mail met de link gekregen.`,
        );
      });
    }
  }

  return NextResponse.json({
    ok: true,
    validUntil: newValidUntil.toISOString(),
    portalUrl,
    mailSent,
    mailError,
  });
}
