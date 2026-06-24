import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuotesListClient } from "./quotes-list-client";
import { calculateQuotePriceSummary, quoteChoiceGroupSchema } from "@/lib/quote-selection";
import { z } from "zod";

export default async function QuotesPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;

  const quotes = companyId
    ? await prisma.quote.findMany({
        where: { companyId },
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
          _count: { select: { items: true } },
        },
        take: 200,
      })
    : [];

  const serialized = JSON.parse(JSON.stringify(quotes));
  const quotesWithPricing = serialized.map((quote: (typeof serialized)[number]) => {
    const parsedGroups = z.array(quoteChoiceGroupSchema).safeParse(quote.choiceGroups ?? []);
    const choiceGroups = parsedGroups.success ? parsedGroups.data : [];
    return {
      ...quote,
      pricing: calculateQuotePriceSummary(quote.items, choiceGroups),
      choiceGroupCount: choiceGroups.length,
    };
  });

  return <QuotesListClient initialQuotes={quotesWithPricing} />;
}
