import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generateQuoteNumber } from "@/lib/format";

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
  options: z.any().optional(),
  exclusions: z.any().optional(),
  assumptions: z.any().optional(),
  technicalNotes: z.any().optional(),
  customerResponsibilities: z.any().optional(),
  planning: z.any().optional(),
  commercial: z.any().optional(),
  batteryAdvice: z.any().optional(),
  choiceGroups: z.any().optional(),
  internalAdvice: z.string().nullable().optional(),
  attachments: z.array(attachmentSchema).optional(),
  items: z.array(itemSchema).min(1, "Voeg minimaal één regel toe"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { 
    customerId, title, category, tagline, itemsHeader, validUntil, 
    intro, outro, notes, quoteType, flow, approach, options, exclusions,
    assumptions, technicalNotes, customerResponsibilities,
    planning, commercial, batteryAdvice, choiceGroups, internalAdvice,
    attachments, items 
  } = parsed.data;

  const count = await prisma.quote.count({ where: { companyId } });
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const number = generateQuoteNumber(company?.slug ?? "xx", count + 1);

  // Calculate totals
  let totalExVat = 0;
  let totalVat = 0;
  const itemsWithTotals = items.map((item, i) => {
    const total = item.qty * item.unitPrice;
    const vatAmount = total * (item.vatRate / 100);
    totalExVat += total;
    totalVat += vatAmount;
    return { ...item, total, sortOrder: i };
  });
  const totalIncVat = totalExVat + totalVat;

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
      totalExVat,
      totalVat,
      totalIncVat,
      items: {
        create: itemsWithTotals,
      },
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
