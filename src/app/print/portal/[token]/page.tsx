import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuoteSheetPreview } from "@/components/quote-sheet-preview";
import { PrintOnLoad } from "@/components/print-on-load";

export default async function PortalPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { token } = await params;
  const { auto } = await searchParams;

  const share = await prisma.quoteShare.findUnique({
    where: { token },
    include: {
      quote: {
        include: {
          customer: true,
          items: { orderBy: { sortOrder: "asc" } },
          attachments: { orderBy: { sortOrder: "asc" } },
          company: true,
        },
      },
    },
  });

  if (!share) notFound();

  const serialized = JSON.parse(JSON.stringify(share.quote));

  return (
    <main className="print-document-page">
      <PrintOnLoad enabled={auto === "1"} />
      <QuoteSheetPreview
        quote={{
          ...serialized,
          acceptedAt: share.acceptedAt ? share.acceptedAt.toISOString() : null,
        }}
        companySlug={serialized.company.slug}
      />
    </main>
  );
}
