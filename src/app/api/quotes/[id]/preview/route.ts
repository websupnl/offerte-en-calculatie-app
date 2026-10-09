import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderQuotePreview } from "@/lib/pdf/render-page-as-pdf";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const quote = await prisma.quote.findFirst({ where: { id, companyId: session.user.activeCompanyId }, include: { share: true } });
  if (!quote) return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
  const startPage = Number(req.nextUrl.searchParams.get("startPage") ?? 0);
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 4);
  if (!Number.isInteger(startPage) || startPage < 0 || !Number.isInteger(limit) || limit < 1 || limit > 4) return NextResponse.json({ error: "startPage moet positief zijn, limit 1 t/m 4" }, { status: 400 });
  const path = quote.share ? `/print/portal/${quote.share.token}?auto=0` : `/print/quotes/${id}?auto=0`;
  try {
    const preview = await renderQuotePreview(new URL(path, req.nextUrl.origin).toString(), req.headers.get("cookie") ?? "", startPage, limit);
    return NextResponse.json({ ...preview, mode: quote.share ? "klantweergave met opgeslagen keuzes" : "conceptweergave", priceSource: "actuele offerte en gekoppelde calculaties" });
  } catch (error) {
    console.error("[Quote preview]", error);
    return NextResponse.json({ error: "Preview renderen mislukt. Controleer de Chromium-configuratie en de printpagina." }, { status: 503 });
  }
}
