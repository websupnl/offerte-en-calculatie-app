import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Intrekken: de link werkt daarna direct niet meer. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.portalAccess.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  await prisma.portalAccess.update({ where: { id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
