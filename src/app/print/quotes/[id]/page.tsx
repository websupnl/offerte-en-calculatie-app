import "@/app/q/[token]/portal.css";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuoteSheetPreview } from "@/components/quote-sheet-preview";
import { PrintOnLoad } from "@/components/print-on-load";
import { resolveQuoteAttachmentImages } from "@/lib/quote-attachments";

export default async function QuotePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { id } = await params;
  const { auto } = await searchParams;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  const quote = await prisma.quote.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      attachments: { orderBy: { sortOrder: "asc" } },
      company: true,
      share: true,
    },
  });

  if (!quote) notFound();

  const attachments = await resolveQuoteAttachmentImages(quote.attachments, {
    expiresIn: 21600,
  });
  const serialized = JSON.parse(JSON.stringify({ ...quote, attachments }));

  return (
    <main className="print-document-page">
      <PrintOnLoad enabled={auto === "1"} />
      <QuoteSheetPreview
        quote={{
          ...serialized,
          acceptedAt: serialized.share?.acceptedAt ?? null,
        }}
        companySlug={serialized.company.slug}
      />
    </main>
  );
}
