import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presignDownload, isStorageConfigured } from "@/lib/storage";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({ productDocumentId: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;

  const quote = await prisma.quote.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!quote) return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const productDocument = await prisma.productDocument.findFirst({
    where: { id: parsed.data.productDocumentId, companyId },
  });
  if (!productDocument) return NextResponse.json({ error: "Document niet gevonden" }, { status: 404 });

  const existing = await prisma.quoteDocument.findFirst({
    where: { quoteId: id, productDocumentId: productDocument.id },
  });
  if (existing) return NextResponse.json({ error: "Al gekoppeld aan deze offerte" }, { status: 409 });

  const created = await prisma.quoteDocument.create({
    data: { quoteId: id, productDocumentId: productDocument.id },
  });

  const url = isStorageConfigured() ? await presignDownload(productDocument.objectKey, 3600) : null;

  return NextResponse.json(
    {
      id: created.id,
      productDocument: { ...productDocument, url },
    },
    { status: 201 },
  );
}
