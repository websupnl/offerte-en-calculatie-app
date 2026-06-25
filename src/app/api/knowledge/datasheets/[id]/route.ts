import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  price: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.datasheet.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
  });
  if (!existing) return NextResponse.json({ error: "Leveranciersprijs niet gevonden" }, { status: 404 });
  const linkedProduct = await prisma.product.findFirst({
    where: { datasheetId: id, companyId: session.user.activeCompanyId },
    select: { id: true },
  });

  const updated = await prisma.$transaction(async (tx) => {
    const datasheet = await tx.datasheet.update({
      where: { id },
      data: parsed.data,
    });
    if (linkedProduct && parsed.data.price !== undefined) {
      await tx.product.update({
        where: { id: linkedProduct.id },
        data: { costPrice: parsed.data.price },
      });
    }
    return datasheet;
  });

  return NextResponse.json(JSON.parse(JSON.stringify(updated)));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await prisma.datasheet.deleteMany({
    where: { id, companyId: session.user.activeCompanyId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Leveranciersprijs niet gevonden" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
