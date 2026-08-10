import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAcceptedNotification } from "@/lib/email";
import { z } from "zod";
import {
  calculateQuoteSelectionTotals,
  quoteChoiceGroupSchema,
  quoteOptionSchema,
  validateQuoteSelection,
} from "@/lib/quote-selection";

const acceptSchema = z.object({
  message: z.string().trim().max(2000).optional().default(""),
  signerName: z.string().trim().min(2, "Vul uw volledige naam in").max(120),
  selectedChoiceIds: z.record(z.string(), z.string()).optional().default({}),
  selectedOptionIds: z.array(z.string()).optional().default([]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsedBody = acceptSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Controleer uw naam en keuzes." }, { status: 400 });
  }

  const share = await prisma.quoteShare.findUnique({
    where: { token },
    include: {
      quote: {
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          customer: true,
          company: true,
        },
      },
    },
  });
  if (!share) return NextResponse.json({ error: "Offerte niet gevonden." }, { status: 404 });
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
  ]);

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
  sendTelegramMessage(telegramMsg).catch(console.error);

  return NextResponse.json({ ok: true, totals, snapshot });
}
