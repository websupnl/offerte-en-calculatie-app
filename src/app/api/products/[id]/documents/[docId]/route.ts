import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject, isStorageConfigured } from "@/lib/storage";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, docId } = await params;

  const doc = await prisma.productDocument.findFirst({
    where: { id: docId, productId: id, companyId: session.user.activeCompanyId },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isStorageConfigured()) {
    try {
      await deleteObject(doc.objectKey);
    } catch {
      return NextResponse.json({ error: "Verwijderen uit storage mislukt" }, { status: 502 });
    }
  }

  await prisma.productDocument.delete({ where: { id: docId } });
  return NextResponse.json({ ok: true });
}
