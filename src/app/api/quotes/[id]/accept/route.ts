import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildQuotePricing, resolvePricing } from "@/lib/quote-pricing";
import { avVersionFor, clientIpFromHeaders } from "@/lib/agreements";
import { syncSubscriptionsForQuote } from "@/lib/subscriptions/from-quote";
import { sendVerbalConfirmationEmail } from "@/lib/email";
import { bouwOpdrachtPayload, donnaBedrijf, meldOpdrachtBijDonna } from "@/lib/donna-opdrachten";
import type { Prisma } from "@/generated/prisma";

/**
 * Een offerte handmatig op akkoord zetten na mondelinge bevestiging.
 *
 * Zelfde gevolgen als een akkoord via het portaal: status ACCEPTED, een
 * AgreementLog-rij (methode VERBAL_CONFIRMED), abonnementen voor de terugkerende
 * regels, en een bevestigingsmail naar de klant.
 */

const bodySchema = z.object({
  method: z.literal("verbal_confirmed"),
  signerName: z.string().trim().min(2).max(120),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) {
    return NextResponse.json({ error: "Geen actief bedrijf" }, { status: 401 });
  }
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: {
      company: true,
      customer: true,
      calculations: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!quote) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  if (quote.status === "ACCEPTED") {
    return NextResponse.json({ error: "Deze offerte staat al op akkoord." }, { status: 409 });
  }

  const pricing = buildQuotePricing(quote.calculations);
  const totals = resolvePricing(pricing);
  const acceptedAt = new Date();
  const clientIp = clientIpFromHeaders(req.headers);

  const snapshot = {
    version: 1,
    method: "verbal_confirmed",
    acceptedAt: acceptedAt.toISOString(),
    signerName: parsed.data.signerName,
    note: parsed.data.note ?? "",
    lines: (pricing.base?.lines ?? []).map((line) => ({
      description: line.description,
      qty: line.qty,
      unitPrice: line.unitPrice,
      vatRate: line.vatRate,
      total: line.total,
      recurringInterval: line.recurringInterval,
    })),
    totals: {
      totalExVat: totals.totalExVat,
      totalVat: totals.totalVat,
      totalIncVat: totals.totalIncVat,
      perMonthExVat: totals.perMonthExVat,
      perQuarterExVat: totals.perQuarterExVat,
      perYearExVat: totals.perYearExVat,
    },
  };

  await prisma.$transaction([
    prisma.quote.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        totalExVat: totals.totalExVat,
        totalVat: totals.totalVat,
        totalIncVat: totals.totalIncVat,
        pdfUrl: null,
      },
    }),
    prisma.quoteEvent.create({
      data: {
        quoteId: id,
        type: "ACCEPTED",
        actor: parsed.data.signerName,
        detail: `Handmatig akkoord (mondeling bevestigd)${parsed.data.note ? ` — ${parsed.data.note}` : ""}`,
        ip: clientIp ?? undefined,
      },
    }),
    prisma.agreementLog.create({
      data: {
        quoteId: id,
        companyId: quote.companyId,
        method: "VERBAL_CONFIRMED",
        ip: clientIp ?? undefined,
        avVersion: avVersionFor(quote.company),
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);

  try {
    await syncSubscriptionsForQuote(prisma, id, { actor: parsed.data.signerName });
  } catch (error) {
    console.error("[QUOTE ACCEPT] abonnementen niet automatisch aangemaakt", error);
    await prisma.quoteEvent
      .create({
        data: { quoteId: id, type: "NOTE", detail: "Abonnementen niet automatisch aangemaakt — controleer handmatig." },
      })
      .catch(() => {});
  }

  const customerEmail = quote.customer.email;
  after(async () => {
    if (customerEmail) {
      await sendVerbalConfirmationEmail({
        to: customerEmail,
        companySlug: quote.company.slug,
        customerName: quote.customer.name,
        quoteNumber: quote.number,
        quoteTitle: quote.title,
      }).catch((error) => console.error("[QUOTE ACCEPT] bevestigingsmail mislukt", error));
    }
  });

  after(async () => {
    const { sendTelegramMessage } = await import("@/lib/notifications");
    await sendTelegramMessage(
      `✅ <b>OFFERTE HANDMATIG OP AKKOORD</b>\n👤 <b>Klant:</b> ${quote.customer.name}\n📄 <b>Offerte:</b> ${quote.number}\n💶 <b>Totaal:</b> € ${totals.totalIncVat.toFixed(2)} incl. btw\n✍️ <b>Bevestigd door:</b> ${parsed.data.signerName} (mondeling)`,
    );
  });

  after(async () => {
    await meldOpdrachtBijDonna(
      donnaBedrijf(quote.company.slug),
      bouwOpdrachtPayload({
        quoteId: quote.id,
        quoteNumber: quote.number,
        title: quote.title,
        customerName: quote.customer.name,
        customerId: quote.customerId,
        totalIncVat: totals.totalIncVat,
        acceptedAt,
        regels: (pricing.base?.lines ?? []).map((line) => ({ description: line.description })),
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
      }),
    );
  });

  return NextResponse.json({ ok: true, totals });
}
