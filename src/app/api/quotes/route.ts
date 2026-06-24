import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generateQuoteNumber } from "@/lib/format";
import { quoteChoiceGroupSchema, quoteOptionSchema } from "@/lib/quote-selection";
import { calculateLine, calculateTotals } from "@/lib/calculation";

const itemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1),
  qty: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().nullable().optional(),
  vatRate: z.coerce.number().default(21),
  indent: z.coerce.number().int().min(0).max(1).default(0),
  type: z.string().optional().default("main"),
});

const attachmentSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional().nullable(),
  imageUrl: z.string().optional().default(""),
  liveUrl: z.string().optional().nullable(),
  caption: z.string().optional().nullable(),
}).refine((attachment) => attachment.imageUrl.trim() || attachment.liveUrl?.trim(), {
  message: "Voeg een screenshot of live link toe",
});

const schema = z.object({
  customerId: z.string().min(1),
  title: z.string().optional(),
  category: z.string().optional(),
  tagline: z.string().optional(),
  itemsHeader: z.string().optional(),
  validUntil: z.string().optional(),
  quoteType: z.string().optional(),
  intro: z.string().optional(),
  outro: z.string().optional(),
  notes: z.string().optional(),
  flow: z.any().optional(),
  approach: z.any().optional(),
  options: z.array(quoteOptionSchema).optional(),
  exclusions: z.any().optional(),
  assumptions: z.any().optional(),
  technicalNotes: z.any().optional(),
  customerResponsibilities: z.any().optional(),
  planning: z.any().optional(),
  commercial: z.any().optional(),
  batteryAdvice: z.any().optional(),
  choiceGroups: z.array(quoteChoiceGroupSchema).optional(),
  internalAdvice: z.string().nullable().optional(),
  attachments: z.array(attachmentSchema).optional(),
  items: z.array(itemSchema).default([]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.items.length === 0 && (parsed.data.choiceGroups?.length ?? 0) === 0) {
    return NextResponse.json({ error: "Voeg minimaal één offerteregel of configuratie toe." }, { status: 400 });
  }

  const { 
    customerId, title, category, tagline, itemsHeader, validUntil, 
    intro, outro, notes, quoteType, flow, approach, options, exclusions,
    assumptions, technicalNotes, customerResponsibilities,
    planning, commercial, batteryAdvice, choiceGroups, internalAdvice,
    attachments, items 
  } = parsed.data;

  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } });
  if (!customer) return NextResponse.json({ error: "Klant bestaat niet binnen het actieve bedrijf." }, { status: 400 });

  const productIds = [...new Set(items.map((item) => item.productId).filter((id): id is string => Boolean(id)))];
  if (productIds.length > 0) {
    const productCount = await prisma.product.count({ where: { id: { in: productIds }, companyId, active: true } });
    if (productCount !== productIds.length) {
      return NextResponse.json({ error: "Een of meer gekoppelde artikelen bestaan niet binnen het actieve bedrijf." }, { status: 400 });
    }
  }

  const count = await prisma.quote.count({ where: { companyId } });
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const number = generateQuoteNumber(company?.slug ?? "xx", count + 1);

  const totals = calculateTotals(items);
  const itemsWithTotals = items.map((item, i) => {
    return { ...item, total: calculateLine(item).revenueExVat, sortOrder: i };
  });

  const quote = await prisma.quote.create({
    data: {
      companyId,
      customerId,
      createdById: session.user.id,
      number,
      title,
      category,
      tagline,
      itemsHeader,
      quoteType,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      intro,
      outro,
      notes,
      flow,
      approach,
      options,
      exclusions,
      assumptions,
      technicalNotes,
      customerResponsibilities,
      planning,
      commercial,
      batteryAdvice,
      choiceGroups,
      internalAdvice,
      totalExVat: totals.revenueExVat,
      totalVat: totals.vat,
      totalIncVat: totals.revenueIncVat,
      items: itemsWithTotals.length ? { create: itemsWithTotals } : undefined,
      attachments: attachments?.length
        ? {
            create: attachments.map(({ id: _id, ...attachment }, sortOrder) => ({
              ...attachment,
              sortOrder,
            })),
          }
        : undefined,
    },
    include: { customer: true, items: true, attachments: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(quote, { status: 201 });
}
