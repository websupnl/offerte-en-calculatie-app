import { NextRequest, NextResponse, after } from "next/server";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { syncQuoteTotalsFromCalculations } from "@/lib/quote-totals";
import { intervalToCycle } from "@/lib/subscriptions/cycle";

const calculationItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional().nullable(),
  type: z.enum(["MATERIAL", "LABOR", "CUSTOM", "SET"]).default("MATERIAL"),
  supplier: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  description: z.string().min(1, "Omschrijving is verplicht"),
  qty: z.coerce.number().min(0.01),
  unit: z.string().optional().default("stuk"),
  costPrice: z.coerce.number().min(0),
  markupPercent: z.coerce.number().default(0),
  unitPrice: z.coerce.number().min(0),
  vatRate: z.coerce.number().default(21),
  optional: z.boolean().default(false),
  hiddenOnQuote: z.boolean().default(false),
  // null = eenmalig. "maand" | "kwartaal" | "jaar" = abonnement; telt niet mee in het eenmalige totaal.
  // lineType en billingCycle worden hier serverside uit afgeleid en meegeschreven.
  recurringInterval: z.enum(["maand", "kwartaal", "jaar"]).nullable().optional(),
  // Toelichting die de klant op de offerte leest bij een optionele regel.
  quoteNote: z.string().trim().max(200).nullable().optional(),
});

const schema = z.object({
  title: z.string().min(1, "Titel is verplicht"),
  description: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "COMPLETED", "QUOTED"]).optional(),
  customerId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  vatRate: z.coerce.number().default(21),
  notes: z.string().optional().nullable(),
  // BASE telt altijd mee in de offerteprijs; VARIANT is een keuze voor de klant.
  role: z.enum(["BASE", "VARIANT"]).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  items: z.array(calculationItemSchema).default([]),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;

  const calculation = await prisma.calculation.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      project: true,
      quote: true,
      items: {
        orderBy: { sortOrder: "asc" },
        include: { product: true },
      },
    },
  });

  if (!calculation) {
    return NextResponse.json({ error: "Calculatie niet gevonden" }, { status: 404 });
  }

  return NextResponse.json(calculation);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;
  const body = await req.json();

  const existing = await prisma.calculation.findFirst({ where: { id, companyId }, include: { quote: { select: { status: true } } } });
  if (!existing) return NextResponse.json({ error: "Calculatie niet gevonden" }, { status: 404 });
  if (existing.quote && existing.quote.status !== "DRAFT") return NextResponse.json({ error: "Deze calculatie hoort bij een verstuurde offerte. Maak een losse kopie om de prijs te wijzigen." }, { status: 409 });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, status, customerId, projectId, vatRate, notes, role, sortOrder, items } = parsed.data;
  const itemIds = items.map(item => item.id).filter((value): value is string => Boolean(value));
  if (new Set(itemIds).size !== itemIds.length || (itemIds.length && await prisma.calculationItem.count({ where: { id: { in: itemIds }, calculationId: id } }) !== itemIds.length)) {
    return NextResponse.json({ error: "Een regel hoort niet bij deze calculatie." }, { status: 400 });
  }
  const productIds = [...new Set(items.map(item => item.productId).filter((value): value is string => Boolean(value)))];
  if (productIds.length && await prisma.product.count({ where: { id: { in: productIds }, companyId } }) !== productIds.length) return NextResponse.json({ error: "Een artikel hoort niet bij dit bedrijf." }, { status: 400 });
  if (customerId && !await prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } })) return NextResponse.json({ error: "Klant hoort niet bij dit bedrijf." }, { status: 400 });
  const project = projectId ? await prisma.project.findFirst({ where: { id: projectId, companyId }, select: { id: true, customerId: true } }) : null;
  if (projectId && (!project || (customerId && project.customerId !== customerId))) return NextResponse.json({ error: "Project hoort niet bij dit bedrijf of deze klant." }, { status: 400 });
  if (existing.quoteId && (customerId !== undefined && customerId !== existing.customerId || projectId !== undefined && projectId !== existing.projectId)) return NextResponse.json({ error: "Wijzig klant en project via de gekoppelde offerte." }, { status: 409 });

  // Calculate totals
  let totalCostPrice = 0;
  let totalSalesPrice = 0;

  const itemsToWrite = items.map((item, index) => {
    const itemCost = item.qty * item.costPrice;
    const calculatedUnitPrice = item.unitPrice > 0 
      ? item.unitPrice 
      : Math.round(item.costPrice * (1 + item.markupPercent / 100) * 100) / 100;
    const itemSales = item.qty * calculatedUnitPrice;

    if (!item.optional && !item.recurringInterval) {
      // Uren zijn eigen arbeid, geen inkoopkost — telt niet mee als kostprijs
      if (item.type !== "LABOR") totalCostPrice += itemCost;
      totalSalesPrice += itemSales;
    }

    return {
      id: item.id,
      productId: item.productId || null,
      type: item.type,
      supplier: item.supplier || null,
      sku: item.sku || null,
      description: item.description,
      qty: item.qty,
      unit: item.unit || "stuk",
      costPrice: item.costPrice,
      markupPercent: item.markupPercent,
      unitPrice: calculatedUnitPrice,
      totalCostPrice: itemCost,
      totalSalesPrice: itemSales,
      vatRate: item.vatRate,
      optional: item.optional,
      hiddenOnQuote: item.hiddenOnQuote,
      recurringInterval: item.recurringInterval ?? null,
      lineType: item.recurringInterval ? ("RECURRING" as const) : ("ONE_OFF" as const),
      billingCycle: item.recurringInterval ? intervalToCycle(item.recurringInterval) : null,
      quoteNote: item.quoteNote || null,
      sortOrder: index,
    };
  });

  const marginAmount = totalSalesPrice - totalCostPrice;
  const marginPercent = totalSalesPrice > 0 ? (marginAmount / totalSalesPrice) * 100 : 0;

  // Regels bijwerken op id in plaats van alles weggooien en opnieuw aanmaken.
  // Het klantportaal onthoudt aangevinkte extra's op regel-id; die mag dus niet
  // veranderen bij elke opslag.
  const bewaardeIds = itemsToWrite.map((item) => item.id).filter((v): v is string => Boolean(v));
  const updated = await prisma.$transaction(async (tx) => {
    await tx.calculationItem.deleteMany({
      where: { calculationId: id, ...(bewaardeIds.length ? { id: { notIn: bewaardeIds } } : {}) },
    });

    for (const { id: itemId, ...data } of itemsToWrite) {
      if (itemId) {
        // upsert, want een regel-id uit de browser kan intussen verwijderd zijn.
        await tx.calculationItem.upsert({
          where: { id: itemId },
          update: data,
          create: { ...data, id: itemId, calculationId: id },
        });
      } else {
        await tx.calculationItem.create({ data: { ...data, calculationId: id } });
      }
    }

    return tx.calculation.update({
      where: { id },
      data: {
        title,
        description,
        status: status ?? existing.status,
        customerId: customerId || null,
        projectId: projectId || null,
        vatRate,
        totalCostPrice,
        totalSalesPrice,
        marginAmount,
        marginPercent,
        notes,
        ...(role ? { role } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
      include: {
        customer: true,
        project: true,
        quote: true,
        items: { orderBy: { sortOrder: "asc" } },
      },
    });
  });

  // De offerte leest zijn prijs uit deze calculatie, dus die moet mee.
  await syncQuoteTotalsFromCalculations(updated.quoteId);
  if (updated.quoteId) {
    const quoteId = updated.quoteId;
    const host = req.headers.get("host") ?? "localhost:3001";
    const cookie = req.headers.get("cookie") ?? "";
    after(async () => { await generateAndStorePdf(quoteId, host, cookie); });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;

  const existing = await prisma.calculation.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Calculatie niet gevonden" }, { status: 404 });

  await prisma.calculation.delete({ where: { id } });
  await syncQuoteTotalsFromCalculations(existing.quoteId);
  if (existing.quoteId) {
    const quoteId = existing.quoteId;
    const host = req.headers.get("host") ?? "localhost:3001";
    const cookie = req.headers.get("cookie") ?? "";
    after(async () => { await generateAndStorePdf(quoteId, host, cookie); });
  }

  return NextResponse.json({ success: true });
}
