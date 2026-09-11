import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendQuoteExtendedEmail } from "@/lib/email";

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
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: { customer: true, company: true, share: true },
  });
  if (!quote) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  if (quote.status === "ACCEPTED") {
    return NextResponse.json({ error: "Een geaccepteerde offerte verleng je niet." }, { status: 409 });
  }

  const newValidUntil = parsed.data.validUntil
    ? new Date(parsed.data.validUntil)
    : (() => {
        const base = new Date();
        base.setDate(base.getDate() + (parsed.data.days ?? 14));
        return base;
      })();

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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
  const portalUrl = `${appUrl}/q/${share.token}`;
  let mailSent = false;

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
    }).catch((error) => {
      console.error("[QUOTE EXTEND] mail mislukt", error);
      return { sent: false as const };
    });
    mailSent = result.sent === true;
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
  });
}
