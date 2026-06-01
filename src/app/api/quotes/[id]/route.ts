import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const itemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  description: z.string().min(1),
  qty: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  vatRate: z.coerce.number().default(21),
});

const schema = z.object({
  customerId: z.string().optional(),
  status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"]).optional(),
  validUntil: z.string().nullable().optional(),
  intro: z.string().optional(),
  outro: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      adviceDocuments: true,
      share: true,
    },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(quote);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { items, ...rest } = parsed.data;

  let updateData: Record<string, unknown> = { ...rest };

  if (items) {
    // Recalculate totals
    let totalExVat = 0;
    let totalVat = 0;
    const itemsWithTotals = items.map((item, i) => {
      const total = item.qty * item.unitPrice;
      const vatAmount = total * (item.vatRate / 100);
      totalExVat += total;
      totalVat += vatAmount;
      return { ...item, total, sortOrder: i };
    });
    updateData = { ...updateData, totalExVat, totalVat, totalIncVat: totalExVat + totalVat };

    // Replace items
    await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
    await prisma.quoteItem.createMany({
      data: itemsWithTotals.map(({ id: _id, ...item }) => ({ ...item, quoteId: id })),
    });
  }

  await prisma.quote.updateMany({
    where: { id, companyId: session.user.activeCompanyId },
    data: updateData,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.quote.deleteMany({
    where: { id, companyId: session.user.activeCompanyId },
  });

  return NextResponse.json({ ok: true });
}
