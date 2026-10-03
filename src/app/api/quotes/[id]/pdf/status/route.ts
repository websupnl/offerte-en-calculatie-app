import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pdfCacheState } from "@/lib/pdf/cache-state";
import { isCurrentPdfCache } from "@/lib/pdf/cache";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { pdfUrl: true },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const state = await pdfCacheState("offerte", id);
  return NextResponse.json({ pdfReady: !!state && isCurrentPdfCache(state.url, state.path) });
}
