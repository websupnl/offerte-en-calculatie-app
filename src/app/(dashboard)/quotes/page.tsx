import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuotesListClient } from "./quotes-list-client";
import { calculateQuotePriceSummary, quoteChoiceGroupSchema } from "@/lib/quote-selection";
import { markExpiredQuotes } from "@/lib/quote-expiry";
import { z } from "zod";
import { applyCalculationPricing } from "@/lib/quote-with-pricing";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  const showArchived = (await searchParams).archived === "1";

  if (companyId) await markExpiredQuotes(companyId);

  const quotes = companyId
    ? await prisma.quote.findMany({
        where: { companyId, archivedAt: showArchived ? { not: null } : null },
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              description: true,
              qty: true,
              unitPrice: true,
              vatRate: true,
              total: true,
            },
          },
          calculations: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
            include: { items: { orderBy: { sortOrder: "asc" } } },
          },
          _count: { select: { items: true } },
        },
        take: 200,
      })
    : [];

  const serialized = JSON.parse(JSON.stringify(quotes));
  const quotesWithPricing = serialized.map((rij: (typeof serialized)[number]) => {
    // Op het nieuwe pad komen regels en varianten uit de calculaties. Zonder deze
    // vertaling rekende de lijst met een lege regellijst en stond er € 0.
    const quote = applyCalculationPricing(rij);
    const parsedGroups = z.array(quoteChoiceGroupSchema).safeParse(quote.choiceGroups ?? []);
    const choiceGroups = parsedGroups.success ? parsedGroups.data : [];
    return {
      ...quote,
      pricing: calculateQuotePriceSummary(quote.items, choiceGroups),
      choiceGroupCount: choiceGroups.length,
    };
  });

  return <QuotesListClient initialQuotes={quotesWithPricing} showArchived={showArchived} />;
}
