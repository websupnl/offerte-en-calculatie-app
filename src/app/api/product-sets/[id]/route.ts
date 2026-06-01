import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const itemSchema = z.object({
  productId: z.string(),
  qty: z.number().min(0.01),
  notes: z.string().optional(),
  sortOrder: z.number().default(0),
});

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.productSet.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, description, category, items } = parsed.data;

  // Replace all items
  await prisma.productSetItem.deleteMany({ where: { setId: id } });

  const set = await prisma.productSet.update({
    where: { id },
    data: {
      name,
      description,
      category,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          notes: item.notes,
          sortOrder: item.sortOrder,
        })),
      },
    },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { product: true },
      },
    },
  });

  return NextResponse.json(set);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.productSet.deleteMany({
    where: { id, companyId: session.user.activeCompanyId },
  });

  return NextResponse.json({ ok: true });
}
