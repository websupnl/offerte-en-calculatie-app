import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Lichte index van alle datasheets/brochures binnen het bedrijf, voor de offerte-picker. */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const documents = await prisma.productDocument.findMany({
    where: { companyId: session.user.activeCompanyId },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { id: true, name: true } } },
  });

  return NextResponse.json(
    documents.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      productId: d.product.id,
      productName: d.product.name,
    })),
  );
}
