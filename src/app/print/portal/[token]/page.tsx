import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuoteSheetPreview } from "@/components/quote-sheet-preview";
import { PrintOnLoad } from "@/components/print-on-load";

export default async function PortalPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ auto?: string; choices?: string; options?: string }>;
}) {
  const { token } = await params;
  const { auto, choices, options } = await searchParams;

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
  const selectedChoiceIds = (share.selectedChoiceIds as Record<string, string> | null)
    ?? parseJsonParam<Record<string, string>>(choices, {});
  const selectedOptionIds = (share.selectedOptionIds as string[] | null)
    ?? parseJsonParam<string[]>(options, []);

  return (
    <main className="print-document-page">
      <PrintOnLoad enabled={auto === "1"} />
      <QuoteSheetPreview
        quote={{
          ...serialized,
          acceptedAt: share.acceptedAt ? share.acceptedAt.toISOString() : null,
        }}
        companySlug={serialized.company.slug}
        selectedChoiceIds={selectedChoiceIds}
        selectedOptionIds={selectedOptionIds}
      />
    </main>
  );
}

function parseJsonParam<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
