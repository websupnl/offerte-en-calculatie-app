import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";

const itemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullable().optional(),
  description: z.string().min(1),
  qty: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  vatRate: z.coerce.number().default(21),
});

const schema = z.object({
  customerId: z.string().optional(),
  title: z.string().optional(),
  category: z.string().optional(),
  tagline: z.string().optional(),
  itemsHeader: z.string().optional(),
  status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"]).optional(),
  validUntil: z.string().nullable().optional().transform((v) => (v === "" ? null : v)),
  intro: z.string().optional(),
  outro: z.string().optional(),
  notes: z.string().optional(),
  flow: z.any().optional(),
  approach: z.any().optional(),
  options: z.any().optional(),
  exclusions: z.any().optional(),
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
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

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

  // Handle validUntil date conversion
  if (updateData.validUntil) {
    updateData.validUntil = new Date(updateData.validUntil as string);
  }

  await prisma.quote.update({
    where: { id, companyId: session.user.activeCompanyId },
    data: updateData,
  });

  // Auto-generate PDF in background after response is sent
  const host = req.headers.get("host") ?? "localhost:3000";
  const cookie = req.headers.get("cookie") ?? "";
  after(async () => {
    await generateAndStorePdf(id, host, cookie);
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
