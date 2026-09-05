import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextCalculationNumber } from "@/lib/calculation-number";
import { syncQuoteTotalsFromCalculations } from "@/lib/quote-totals";

/**
 * Een calculatie aanmaken vóór een offerte. Dit is het enige pad waarlangs een
 * offerte aan een prijs komt: geen losse offerteregels meer, maar een calculatie
 * met artikelen, inkoop en marge.
 *
 * Drie situaties, één route:
 *   - de offerte heeft nog niets      -> lege basiscalculatie
 *   - de offerte heeft al een basis   -> een variant, de klant kiest straks
 *   - de offerte heeft nog oude regels -> `moveItems` neemt ze mee en ruimt ze op
 */

const schema = z.object({
  title: z.string().trim().min(1).optional(),
  role: z.enum(["BASE", "VARIANT"]).optional(),
  /** Bestaande QuoteItem-regels overnemen in de nieuwe calculatie. */
  moveItems: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const quote = await prisma.quote.findFirst({
    where: { id, companyId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      calculations: { select: { id: true, role: true, sortOrder: true } },
    },
  });
  if (!quote) return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });

  // Een verstuurde offerte omzetten zou de prijs onder de klant vandaan halen.
  if (quote.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Deze offerte is al verstuurd. Maak een nieuwe offerte in plaats van deze om te bouwen." },
      { status: 409 },
    );
  }

  const heeftBasis = quote.calculations.some((calculation) => calculation.role !== "VARIANT");
  const role = parsed.data.role ?? (heeftBasis ? "VARIANT" : "BASE");
  const moveItems = parsed.data.moveItems === true && quote.items.length > 0;

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } });
  const number = await nextCalculationNumber(companyId, company?.slug ?? "xx");
  const sortOrder = Math.max(-1, ...quote.calculations.map((c) => c.sortOrder)) + 1;

  const regels = moveItems
    ? quote.items.map((item, index) => {
        const qty = Number(item.qty);
        const unitPrice = Number(item.unitPrice);
        const costPrice = item.costPrice === null ? 0 : Number(item.costPrice);
        return {
          productId: item.productId,
          // Zonder inkoopprijs weten we niet of het materiaal of eigen werk is.
          // MATERIAL met kostprijs 0 zou een marge van 100% suggereren, dus dan
          // boeken we het als eigen uren: die tellen niet mee als inkoop.
          type: costPrice > 0 ? ("MATERIAL" as const) : ("LABOR" as const),
          description: item.description,
          qty,
          unit: "stuk",
          costPrice,
          markupPercent: 0,
          unitPrice,
          totalCostPrice: qty * costPrice,
          totalSalesPrice: qty * unitPrice,
          vatRate: Number(item.vatRate),
          hiddenOnQuote: item.hiddenOnQuote,
          sortOrder: index,
        };
      })
    : [];

  const totalCostPrice = regels
    .filter((regel) => regel.type !== "LABOR")
    .reduce((sum, regel) => sum + regel.totalCostPrice, 0);
  const totalSalesPrice = regels.reduce((sum, regel) => sum + regel.totalSalesPrice, 0);
  const marginAmount = totalSalesPrice - totalCostPrice;

  const calculation = await prisma.$transaction(async (tx) => {
    const created = await tx.calculation.create({
      data: {
        companyId,
        customerId: quote.customerId,
        projectId: quote.projectId,
        quoteId: quote.id,
        number,
        title: parsed.data.title ?? quote.title ?? `Calculatie ${quote.number}`,
        status: "DRAFT",
        role,
        sortOrder,
        vatRate: quote.vatRate,
        totalCostPrice,
        totalSalesPrice,
        marginAmount,
        marginPercent: totalSalesPrice > 0 ? (marginAmount / totalSalesPrice) * 100 : 0,
        items: regels.length ? { create: regels } : undefined,
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    // Pas opruimen als de regels echt overgenomen zijn. Zolang er QuoteItems
    // staan, blijft de offerte op het oude pad renderen (zie usesCalculationPricing).
    if (moveItems) {
      await tx.quoteItem.deleteMany({ where: { quoteId: quote.id } });
    }

    return created;
  });

  await syncQuoteTotalsFromCalculations(quote.id);

  return NextResponse.json(calculation, { status: 201 });
}
