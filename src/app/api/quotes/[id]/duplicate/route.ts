import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";
import { nextCalculationNumber } from "@/lib/calculation-number";
import { syncQuoteTotalsFromCalculations } from "@/lib/quote-totals";
import { remapChoiceCalculationIds } from "@/lib/quote-revision";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { readPresentation } from "@/lib/quote-presentation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;
  const input = z.object({ customerId: z.string().min(1).optional() }).strict().safeParse(await req.json().catch(() => ({})));
  if (!input.success) return NextResponse.json({ error: input.error.flatten() }, { status: 400 });
  if (input.data.customerId && !await prisma.customer.findFirst({ where: { id: input.data.customerId, companyId }, select: { id: true } })) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const source = await prisma.quote.findFirst({
    where: { id, companyId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      modules: { orderBy: { sortOrder: "asc" } },
      contentBlocks: { orderBy: { sortOrder: "asc" } },
      calculations: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
      attachments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await prisma.company.findUnique({ where: { id: companyId } });

  const duplicate = await prisma.quote.create({
    data: {
      companyId,
      customerId: input.data.customerId ?? source.customerId,
      createdById: session.user.id,
      title: source.title,
      category: source.category,
      tagline: source.tagline,
      itemsHeader: source.itemsHeader,
      status: "DRAFT",
      quoteType: source.quoteType,
      validUntil: source.validUntil,
      intro: source.intro,
      outro: source.outro,
      notes: source.notes,
      vatRate: source.vatRate,
      discount: source.discount,
      flow: source.flow ?? undefined,
      approach: source.approach ?? undefined,
      options: source.options ?? undefined,
      exclusions: source.exclusions ?? undefined,
      assumptions: source.assumptions ?? undefined,
      technicalNotes: source.technicalNotes ?? undefined,
      customerResponsibilities: source.customerResponsibilities ?? undefined,
      planning: source.planning ?? undefined,
      commercial: source.commercial ?? undefined,
      batteryAdvice: source.batteryAdvice ?? undefined,
      choiceGroups: source.choiceGroups ?? undefined,
      internalAdvice: source.internalAdvice,
      hiddenSections: source.hiddenSections,
      totalExVat: source.totalExVat,
      totalVat: source.totalVat,
      totalIncVat: source.totalIncVat,
      items: source.items.length
        ? {
            create: source.items.map((item) => ({
              productId: item.productId,
              description: item.description,
              qty: item.qty,
              unitPrice: item.unitPrice,
              costPrice: item.costPrice,
              vatRate: item.vatRate,
              total: item.total,
              sortOrder: item.sortOrder,
              indent: item.indent,
              type: item.type,
              choiceGroupId: item.choiceGroupId,
              hiddenOnQuote: item.hiddenOnQuote,
            })),
          }
        : undefined,
      modules: source.modules.length
        ? {
            create: source.modules.map((m) => ({
              key: m.key, title: m.title, summary: m.summary, tag: m.tag,
              price: m.price, recurringPrice: m.recurringPrice, recurringInterval: m.recurringInterval,
              vatRate: m.vatRate, required: m.required, defaultSelected: m.defaultSelected,
              details: m.details as object, technicalCondition: m.technicalCondition, sortOrder: m.sortOrder,
            })),
          }
        : undefined,
      contentBlocks: source.contentBlocks.length
        ? {
            create: source.contentBlocks.map((blok) => ({
              type: blok.type, title: blok.title, body: blok.body,
              items: blok.items as object, tone: blok.tone,
              imageUrl: blok.imageUrl, caption: blok.caption, sortOrder: blok.sortOrder,
            })),
          }
        : undefined,
      attachments: source.attachments.length
        ? {
            create: source.attachments.map((attachment) => ({
              title: attachment.title,
              imageUrl: attachment.imageUrl,
              liveUrl: attachment.liveUrl,
              caption: attachment.caption,
              section: attachment.section,
              sortOrder: attachment.sortOrder,
            })),
          }
        : undefined,
    },
    include: { customer: true, items: { orderBy: { sortOrder: "asc" } }, attachments: { orderBy: { sortOrder: "asc" } } },
  });

  // Calculaties krijgen elk een eigen nummer, dus die kunnen niet als geneste
  // create mee. Zonder deze kopie zou een gedupliceerde offerte op het nieuwe
  // pad helemaal geen prijs hebben.
  const calculationIdMap = new Map<string, string>();
  const itemIdMap = new Map(source.items.map((item, index) => [item.id, duplicate.items[index].id]));
  for (const bron of source.calculations) {
    const calculatieNummer = await nextCalculationNumber(companyId, company?.slug ?? "xx");
    const copiedCalculation = await prisma.calculation.create({
      data: {
        companyId,
        customerId: input.data.customerId ?? bron.customerId,
        projectId: input.data.customerId && input.data.customerId !== source.customerId ? null : bron.projectId,
        quoteId: duplicate.id,
        number: calculatieNummer,
        title: bron.title,
        description: bron.description,
        status: "DRAFT",
        role: bron.role,
        sortOrder: bron.sortOrder,
        vatRate: bron.vatRate,
        totalCostPrice: bron.totalCostPrice,
        totalSalesPrice: bron.totalSalesPrice,
        marginAmount: bron.marginAmount,
        marginPercent: bron.marginPercent,
        notes: bron.notes,
        items: bron.items.length
          ? {
              create: bron.items.map((regel) => ({
                productId: regel.productId, type: regel.type, supplier: regel.supplier,
                sku: regel.sku, description: regel.description, qty: regel.qty, unit: regel.unit,
                costPrice: regel.costPrice, markupPercent: regel.markupPercent,
                unitPrice: regel.unitPrice, totalCostPrice: regel.totalCostPrice,
                totalSalesPrice: regel.totalSalesPrice, vatRate: regel.vatRate,
                optional: regel.optional, hiddenOnQuote: regel.hiddenOnQuote,
                recurringInterval: regel.recurringInterval, quoteNote: regel.quoteNote,
                lineType: regel.lineType, billingCycle: regel.billingCycle,
                sortOrder: regel.sortOrder,
              })),
            }
          : undefined,
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    calculationIdMap.set(bron.id, copiedCalculation.id);
    bron.items.forEach((item, index) => itemIdMap.set(item.id, copiedCalculation.items[index].id));
  }
  const presentation = readPresentation(source.commercial);
  const remap = (entries: Record<string, unknown> | undefined) => Object.fromEntries(Object.entries(entries ?? {}).map(([key, value]) => [calculationIdMap.get(key) ?? itemIdMap.get(key) ?? key, value]));
  const commercial = source.commercial && typeof source.commercial === "object" && !Array.isArray(source.commercial) ? source.commercial : {};
  await prisma.quote.update({ where: { id: duplicate.id }, data: { commercial: { ...commercial, presentation: { ...presentation, options: remap(presentation.options), items: remap(presentation.items) } } as Prisma.InputJsonValue } });
  if (calculationIdMap.size > 0 && source.choiceGroups) {
    const remappedChoices = remapChoiceCalculationIds(source.choiceGroups, calculationIdMap);
    await prisma.quote.update({
      where: { id: duplicate.id },
      data: { choiceGroups: remappedChoices as Prisma.InputJsonValue },
    });
  }
  if (source.calculations.length) {
    await syncQuoteTotalsFromCalculations(duplicate.id);
  }

  const host = req.headers.get("host") ?? "localhost:3000";
  const cookie = req.headers.get("cookie") ?? "";
  after(async () => {
    await generateAndStorePdf(duplicate.id, host, cookie);
  });

  return NextResponse.json(duplicate, { status: 201 });
}
