import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const deleted = await prisma.quoteTemplate.deleteMany({
    where: { id, companyId: session.user.activeCompanyId },
  });
  if (deleted.count === 0) return NextResponse.json({ error: "Template niet gevonden" }, { status: 404 });
  return NextResponse.json({ success: true });
}
