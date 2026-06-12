import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const category = req.nextUrl.searchParams.get("category") ?? "";

  const datasheets = await prisma.datasheet.findMany({
    where: {
      companyId,
      AND: [
        q ? {
          OR: [
            { brand: { contains: q, mode: "insensitive" } },
            { model: { contains: q, mode: "insensitive" } },
            { notes: { contains: q, mode: "insensitive" } },
          ],
        } : {},
        category ? { category: { equals: category, mode: "insensitive" } } : {},
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json(datasheets);
}
