import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quoteDocumentSchema } from "@/lib/quote-document";
import { z } from "zod";

const updateSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  document: quoteDocumentSchema,
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { document: true, documentRevision: true, updatedAt: true },
  });
  if (!quote) return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
  return NextResponse.json(quote);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const calculationIds = parsed.data.document.blocks
    .filter((block) => block.type === "calculation")
    .map((block) => block.snapshot.calculationId);
  if (calculationIds.length > 0) {
    const ownedCount = await prisma.calculation.count({
      where: { id: { in: [...new Set(calculationIds)] }, companyId: session.user.activeCompanyId },
    });
    if (ownedCount !== new Set(calculationIds).size) {
      return NextResponse.json({ error: "Een gekoppelde calculatie is niet beschikbaar binnen dit bedrijf." }, { status: 400 });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.quote.updateMany({
      where: {
        id,
        companyId: session.user.activeCompanyId,
        status: { not: "ACCEPTED" },
        documentRevision: parsed.data.expectedRevision,
      },
      data: {
        document: parsed.data.document,
        documentRevision: { increment: 1 },
        pdfUrl: null,
      },
    });
    if (updated.count === 0) return null;
    await tx.quoteShare.updateMany({ where: { quoteId: id }, data: { portalPdfUrl: null } });
    return tx.quote.findUnique({
      where: { id },
      select: { documentRevision: true, updatedAt: true },
    });
  });

  if (!result) {
    const current = await prisma.quote.findFirst({
      where: { id, companyId: session.user.activeCompanyId },
      select: { status: true, documentRevision: true },
    });
    if (!current) return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
    if (current.status === "ACCEPTED") {
      return NextResponse.json({ error: "Een geaccepteerde offerte is vergrendeld." }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Deze offerte is ondertussen elders gewijzigd.", currentRevision: current.documentRevision },
      { status: 409 },
    );
  }

  return NextResponse.json(result);
}
