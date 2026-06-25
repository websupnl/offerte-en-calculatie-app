import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().default("stuk"),
  basePrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).nullable().optional(),
  vatRate: z.coerce.number().min(0).max(100).default(21),
  specs: z.record(z.string(), z.unknown()).optional().default({}),
  active: z.boolean().default(true),
  datasheetId: z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const datasheet = parsed.data.datasheetId
    ? await prisma.datasheet.findFirst({
        where: { id: parsed.data.datasheetId, companyId: session.user.activeCompanyId },
      })
    : null;
  if (parsed.data.datasheetId && !datasheet) {
    return NextResponse.json({ error: "Leveranciersprijs bestaat niet binnen het actieve bedrijf." }, { status: 400 });
  }
  const linkedProduct = datasheet
    ? await prisma.product.findFirst({
        where: { datasheetId: datasheet.id, companyId: session.user.activeCompanyId },
        select: { id: true },
      })
    : null;
  if (linkedProduct && linkedProduct.id !== id) {
    return NextResponse.json({ error: "Deze leveranciersprijs is al aan een ander artikel gekoppeld." }, { status: 409 });
  }

  const result = await prisma.product.updateMany({
    where: { id, companyId: session.user.activeCompanyId },
    data: {
      ...parsed.data,
      costPrice: datasheet?.price ?? parsed.data.costPrice,
      specs: JSON.parse(JSON.stringify(parsed.data.specs ?? {})),
    },
  });

  if (result.count === 0) return NextResponse.json({ error: "Product niet gevonden" }, { status: 404 });

  const product = await prisma.product.findUnique({ where: { id } });
  return NextResponse.json(product);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await prisma.product.updateMany({
    where: { id, companyId: session.user.activeCompanyId },
    data: { active: false },
  });

  if (result.count === 0) return NextResponse.json({ error: "Product niet gevonden" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
