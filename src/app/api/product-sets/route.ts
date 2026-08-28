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

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sets = await prisma.productSet.findMany({
    where: { companyId: session.user.activeCompanyId, active: true },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { product: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(sets);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, description, category, items } = parsed.data;
  const productIds = [...new Set(items.map((item) => item.productId))];
  const ownedProductCount = await prisma.product.count({
    where: { id: { in: productIds }, companyId: session.user.activeCompanyId, active: true },
  });
  if (ownedProductCount !== productIds.length) {
    return NextResponse.json({ error: "Een of meer artikelen bestaan niet binnen dit bedrijf." }, { status: 400 });
  }

  const set = await prisma.productSet.create({
    data: {
      name,
      description,
      category,
      companyId: session.user.activeCompanyId,
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

  return NextResponse.json(set, { status: 201 });
}
