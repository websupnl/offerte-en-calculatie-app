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
  vatRate: z.coerce.number().default(21),
});

const schema = z.object({
  customerId: z.string().min(1),
  validUntil: z.string().optional(),
  intro: z.string().optional(),
  outro: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Voeg minimaal één regel toe"),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const status = req.nextUrl.searchParams.get("status");

  const quotes = await prisma.quote.findMany({
    where: {
      companyId,
      status: (status as "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "DECLINED" | "EXPIRED") || undefined,
    },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json(quotes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { customerId, validUntil, intro, outro, notes, items } = parsed.data;

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
      validUntil: validUntil ? new Date(validUntil) : undefined,
      intro,
      outro,
      notes,
      totalExVat,
      totalVat,
      totalIncVat,
      items: {
        create: itemsWithTotals,
      },
    },
    include: { customer: true, items: true },
  });

  return NextResponse.json(quote, { status: 201 });
}
