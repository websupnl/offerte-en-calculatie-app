import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncQuoteTotalsFromCalculations } from "@/lib/quote-totals";

/** Werk de conceptofferte opnieuw bij vanuit de gekoppelde calculaties. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const calculation = await prisma.calculation.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: {
      quoteId: true,
      quote: { select: { id: true, status: true, items: { select: { id: true }, take: 1 } } },
    },
  });
  if (!calculation?.quote) {
    return NextResponse.json({ error: "Deze calculatie is niet gekoppeld aan een offerte" }, { status: 404 });
  }
  if (calculation.quote.status !== "DRAFT") {
    return NextResponse.json({ error: "Alleen een conceptofferte kan worden bijgewerkt" }, { status: 409 });
  }
  if (calculation.quote.items.length > 0) {
    return NextResponse.json(
      { error: "Zet eerst de losse offerteregels om naar de calculatie voordat je deze offerte bijwerkt" },
      { status: 409 },
    );
  }

  await syncQuoteTotalsFromCalculations(calculation.quote.id);
  return NextResponse.json({ quoteId: calculation.quote.id });
}
