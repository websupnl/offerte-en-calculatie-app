import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { modulesToOptions } from "@/lib/quote-modules";
import { applyCalculationPricing } from "@/lib/quote-with-pricing";
import { validateQuotePresentation } from "@/lib/quote-validation";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const quote = await prisma.quote.findFirst({ where: { id, companyId: session.user.activeCompanyId }, include: {
    customer: true, items: true, modules: true, contentBlocks: true, calculations: { where: { archivedAt: null }, include: { items: true } },
  } });
  if (!quote) return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
  const shape = applyCalculationPricing({ ...quote, options: modulesToOptions(quote.modules) }, { internal: true });
  return NextResponse.json(validateQuotePresentation(shape));
}
