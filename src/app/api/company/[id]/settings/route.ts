import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify user has access to this company
  const access = await prisma.companyUser.findFirst({
    where: { userId: session.user.id, companyId: id },
  });
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { settings, branding } = await req.json();

  await prisma.company.update({
    where: { id },
    data: { settings, branding },
  });

  return NextResponse.json({ ok: true });
}
