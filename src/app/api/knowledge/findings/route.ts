import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const q = req.nextUrl.searchParams.get("q") ?? "";

  const findings = await prisma.researchFinding.findMany({
    where: {
      companyId,
      ...(q ? {
        OR: [
          { topic: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      quote: { select: { id: true, number: true, title: true } },
    },
  });

  return NextResponse.json(findings);
}
