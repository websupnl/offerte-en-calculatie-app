import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; quoteDocumentId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, quoteDocumentId } = await params;

  const link = await prisma.quoteDocument.findFirst({
    where: { id: quoteDocumentId, quoteId: id, quote: { companyId: session.user.activeCompanyId } },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.quoteDocument.delete({ where: { id: quoteDocumentId } });
  return NextResponse.json({ ok: true });
}
