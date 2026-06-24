import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuotesListClient } from "./quotes-list-client";

export default async function QuotesPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;

  const quotes = companyId
    ? await prisma.quote.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          _count: { select: { items: true } },
        },
        take: 200,
      })
    : [];

  return <QuotesListClient initialQuotes={JSON.parse(JSON.stringify(quotes))} />;
}
