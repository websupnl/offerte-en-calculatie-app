import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAcceptedNotification } from "@/lib/email";
import { z } from "zod";
import {
  calculateQuoteSelectionTotals,
  quoteChoiceGroupSchema,
  quoteOptionSchema,
  validateQuoteSelection,
} from "@/lib/quote-selection";
import { modulesToOptions } from "@/lib/quote-modules";
import { applyCalculationPricing } from "@/lib/quote-with-pricing";
import { bouwOpdrachtPayload, donnaBedrijf, meldOpdrachtBijDonna } from "@/lib/donna-opdrachten";
import { avVersionFor, clientIpFromHeaders } from "@/lib/agreements";
import { syncSubscriptionsForQuote } from "@/lib/subscriptions/from-quote";
import type { Prisma } from "@/generated/prisma";

const acceptSchema = z.object({
  message: z.string().trim().max(2000).optional().default(""),
  signerName: z.string().trim().min(2, "Vul uw volledige naam in").max(120),
  // Verplicht: de klant moet de voorwaarden aanvinken. z.literal(true) weigert
  // een ontbrekend of false vinkje.
  agreedToTerms: z.literal(true, { message: "Ga akkoord met de voorwaarden om verder te gaan" }),
  selectedChoiceIds: z.record(z.string(), z.string()).optional().default({}),
  selectedOptionIds: z.array(z.string()).optional().default([]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsedBody = acceptSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    const firstIssue = parsedBody.error.issues[0]?.message;
    return NextResponse.json(
      { error: firstIssue ?? "Controleer uw naam en keuzes." },
      { status: 400 },
    );
  }

  const gedeeld = await prisma.quoteShare.findUnique({
    where: { token },
    include: {
      quote: {
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          // Modules staan in hun eigen tabel. Zonder deze twee zou de klant zijn
          // keuzes laten valideren tegen een lege lijst, en dan verdwijnt wat hij
          // heeft aangevinkt stil uit de acceptatie.
          modules: { orderBy: { sortOrder: "asc" } },
          calculations: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
            include: { items: { orderBy: { sortOrder: "asc" } } },
          },
          customer: true,
          company: true,
        },
      },
    },
  });
  if (!gedeeld) return NextResponse.json({ error: "Offerte niet gevonden." }, { status: 404 });

  // Precies dezelfde vertaling als het klantportaal doet, zodat wat de klant
  // accepteert overeenkomt met wat hij op het scherm zag staan.
  const share = {
    ...gedeeld,
    quote: applyCalculationPricing({
      ...gedeeld.quote,
      options: modulesToOptions(gedeeld.quote.modules),
    }),
  };
  if (share.acceptedAt || share.declinedAt) {
    return NextResponse.json({ error: "Deze offerte is al beantwoord." }, { status: 409 });
  }
  if (share.quote.validUntil && share.quote.validUntil.getTime() < Date.now()) {
    return NextResponse.json({ error: "Deze offerte is verlopen." }, { status: 410 });
  }

  const choiceGroupsResult = z.array(quoteChoiceGroupSchema).safeParse(share.quote.choiceGroups ?? []);
  const optionsResult = z.array(quoteOptionSchema).safeParse(share.quote.options ?? []);
  if (!choiceGroupsResult.success) {
    return NextResponse.json({ error: "De keuzemodules in deze offerte zijn niet geldig. Neem contact op met de aanbieder." }, { status: 422 });
  }
  const selectableOptions = optionsResult.success ? optionsResult.data : [];

  const selection = {
    selectedChoiceIds: parsedBody.data.selectedChoiceIds,
    selectedOptionIds: [...new Set(parsedBody.data.selectedOptionIds)],
  };
  const selectionErrors = validateQuoteSelection(choiceGroupsResult.data, selectableOptions, selection);
  if (selectionErrors.length) {
    return NextResponse.json({ error: selectionErrors[0], errors: selectionErrors }, { status: 422 });
  }

  const totals = calculateQuoteSelectionTotals(
    share.quote.items.map((item) => ({
      id: item.id,
      description: item.description,
      qty: Number(item.qty),
      unitPrice: Number(item.unitPrice),
      vatRate: Number(item.vatRate),
      total: Number(item.total),
      hiddenOnQuote: item.hiddenOnQuote,
    })),
    choiceGroupsResult.data,
    selectableOptions,
    selection,
  );
  const selectedChoices = choiceGroupsResult.data.map((group) => ({
    groupId: group.id,
    groupTitle: group.title,
    choice: group.choices.find((choice) => choice.id === selection.selectedChoiceIds[group.id])!,
  }));
  const selectedOptions = selectableOptions.filter((option) => selection.selectedOptionIds.includes(option.id));
  const acceptedAt = new Date();
  const snapshot = {
    version: 1,
    acceptedAt: acceptedAt.toISOString(),
    signerName: parsedBody.data.signerName,
    baseItems: share.quote.items.map((item) => ({
      description: item.description,
      qty: Number(item.qty),
      unitPrice: Number(item.unitPrice),
      vatRate: Number(item.vatRate),
      total: Number(item.total),
      hiddenOnQuote: item.hiddenOnQuote,
    })),
    selectedChoices,
    selectedOptions,
    totals,
  };

  const clientIp = clientIpFromHeaders(req.headers);
  const avVersion = avVersionFor(share.quote.company);

  await prisma.$transaction([
    prisma.quoteShare.update({
      where: { token },
      data: {
        acceptedAt,
        message: parsedBody.data.message,
        signerName: parsedBody.data.signerName,
        selectedChoiceIds: selection.selectedChoiceIds,
        selectedOptionIds: selection.selectedOptionIds,
        acceptedTotalExVat: totals.totalExVat,
        acceptedTotalVat: totals.totalVat,
        acceptedTotalIncVat: totals.totalIncVat,
        acceptanceSnapshot: snapshot,
      },
    }),
    prisma.quote.update({
      where: { id: share.quoteId },
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
        quoteId: share.quoteId,
        type: "ACCEPTED",
        actor: parsedBody.data.signerName,
        detail: `Totaal € ${totals.totalIncVat.toFixed(2)} incl. btw`,
        ip: clientIp ?? undefined,
      },
    }),
    // Het onveranderbare juridische record. Staat in dezelfde transactie als de
    // statuswissel: geen akkoord zonder akkoord-log.
    prisma.agreementLog.create({
      data: {
        quoteId: share.quoteId,
        companyId: share.quote.company.id,
        method: "DIGITAL",
        ip: clientIp ?? undefined,
        avVersion,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);

  // Elke terugkerende calculatieregel die de klant accepteerde wordt een
  // abonnement. Idempotent, en buiten de transactie: een databasehik hier mag
  // het akkoord van de klant niet terugdraaien.
  try {
    await syncSubscriptionsForQuote(prisma, share.quoteId, {
      actor: parsedBody.data.signerName,
    });
  } catch (error) {
    console.error("[ACCEPT] abonnementen niet automatisch aangemaakt", error);
    await prisma.quoteEvent
      .create({
        data: {
          quoteId: share.quoteId,
          type: "NOTE",
          detail: "Abonnementen niet automatisch aangemaakt — controleer via de offerte.",
        },
      })
      .catch(() => {});
  }

  const settings = (share.quote.company.settings ?? {}) as Record<string, unknown>;
  const notifyEmail = (settings.notifyEmail as string | undefined) ?? (settings.emailFrom as string | undefined);
  if (notifyEmail) {
    await sendAcceptedNotification({
      to: notifyEmail,
      companySlug: share.quote.company.slug,
      customerName: share.quote.customer.name,
      quoteNumber: share.quote.number,
      message: [
        parsedBody.data.message,
        ...selectedChoices.map(({ groupTitle, choice }) => `${groupTitle}: ${choice.title}`),
        ...selectedOptions.map((option) => `Meerwerk: ${option.t}`),
      ].filter(Boolean).join("\n"),
    }).catch(() => {});
  }

  const selectionSummary = [
    ...selectedChoices.map(({ choice }) => choice.title),
    ...selectedOptions.map((option) => option.t),
  ].join(", ") || "Standaardofferte";
  const telegramMsg = `
✅ <b>OFFERTE GEACCEPTEERD!</b>
👤 <b>Klant:</b> ${share.quote.customer.name}
✍️ <b>Ondertekend door:</b> ${parsedBody.data.signerName}
📄 <b>Offerte:</b> ${share.quote.number}
🧩 <b>Samenstelling:</b> ${selectionSummary}
💶 <b>Totaal:</b> € ${totals.totalIncVat.toFixed(2)} incl. btw
💬 <b>Bericht:</b> ${parsedBody.data.message || "Geen bericht"}
  `.trim();

  const { sendTelegramMessage } = await import("@/lib/notifications");
  // In after() en niet als losse aanroep ernaast: op Vercel wordt de functie
  // bevroren zodra het antwoord verstuurd is, en dan wordt een lopende fetch
  // afgekapt. Zo belandde een geaccepteerde offerte wel in de database, maar
  // kwam de melding nooit op je telefoon aan.
  after(async () => {
    await sendTelegramMessage(telegramMsg);
  });

  // Donna maakt van een akkoord een project met een taak. Dit staat bewust ná
  // de statuswijziging en in after(): valt Donna uit, dan blijft het akkoord van
  // de klant gewoon staan. Donna ontdubbelt op reference, dus opnieuw sturen kan.
  after(async () => {
    await meldOpdrachtBijDonna(
      donnaBedrijf(share.quote.company.slug),
      bouwOpdrachtPayload({
        quoteId: share.quote.id,
        quoteNumber: share.quote.number,
        title: share.quote.title,
        customerName: share.quote.customer.name,
        customerId: share.quote.customerId,
        totalIncVat: totals.totalIncVat,
        acceptedAt,
        regels: [
          ...snapshot.baseItems.filter((regel) => !regel.hiddenOnQuote),
          ...selectedChoices.map(({ choice }) => ({ description: choice.title })),
          ...selectedOptions.map((optie) => ({ description: `Meerwerk: ${optie.t}` })),
        ],
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
      }),
    );
  });

  return NextResponse.json({ ok: true, totals, snapshot });
}
