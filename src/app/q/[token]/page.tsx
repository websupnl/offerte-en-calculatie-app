import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { QuotePortalClient } from "./quote-portal-client";

export default async function QuotePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const share = await prisma.quoteShare.findUnique({
    where: { token },
    include: {
      quote: {
        include: {
          customer: true,
          items: { orderBy: { sortOrder: "asc" } },
          adviceDocuments: { orderBy: { createdAt: "desc" } },
          company: true,
        },
      },
    },
  });

  if (!share) notFound();

  // Mark as viewed if not yet
  if (!share.viewedAt && !share.acceptedAt && !share.declinedAt) {
    await prisma.quoteShare.update({
      where: { id: share.id },
      data: { viewedAt: new Date() },
    });
    // Update quote status to VIEWED
    await prisma.quote.update({
      where: { id: share.quoteId },
      data: { status: "VIEWED" },
    });
  }

  const branding = (share.quote.company.branding ?? {}) as Record<string, string>;
  const slug = share.quote.company.slug;

  return (
    <QuotePortalClient
      quote={share.quote as never}
      share={share as never}
      companySlug={slug}
      branding={branding}
    />
  );
}
