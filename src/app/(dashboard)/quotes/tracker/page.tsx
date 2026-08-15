import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TrackerClient } from "./tracker-client";

export default async function QuoteTrackerPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;

  const quotes = companyId
    ? await prisma.quote.findMany({
        where: { companyId, sentAt: { not: null } },
        orderBy: { lastSentAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          share: {
            select: {
              viewedAt: true,
              lastViewedAt: true,
              viewCount: true,
              acceptedAt: true,
              declinedAt: true,
            },
          },
        },
        take: 300,
      })
    : [];

  const serialized = JSON.parse(JSON.stringify(quotes));

  return <TrackerClient initialQuotes={serialized} />;
}
