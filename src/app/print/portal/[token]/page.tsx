import "@/app/q/[token]/portal.css";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuoteSheetPreview } from "@/components/quote-sheet-preview";
import { PrintOnLoad } from "@/components/print-on-load";
import { resolveQuoteAttachmentImages, resolveChoiceGroupImages } from "@/lib/quote-attachments";
import { modulesToOptions } from "@/lib/quote-modules";
import { applyCalculationPricing } from "@/lib/quote-with-pricing";

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
          modules: { orderBy: { sortOrder: "asc" } },
          calculations: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
            include: { items: { orderBy: { sortOrder: "asc" } } },
          },
          contentBlocks: { orderBy: { sortOrder: "asc" } },
          attachments: { orderBy: { sortOrder: "asc" } },
          company: true,
        },
      },
    },
  });

  if (!share) notFound();

  const attachments = await resolveQuoteAttachmentImages(
    share.quote.attachments,
    { expiresIn: 21600 },
  );
  const choiceGroups = await resolveChoiceGroupImages(
    (Array.isArray(share.quote.choiceGroups) ? share.quote.choiceGroups : []) as Array<{
      choices: Array<{ image?: string | null; imageUrl?: string | null }>;
    }>,
    { expiresIn: 21600 },
  );
  const serialized = JSON.parse(JSON.stringify(applyCalculationPricing({
    ...share.quote,
    // Modules staan in hun eigen tabel; de preview leest ze als `options`.
    options: modulesToOptions(share.quote.modules),
    attachments,
    choiceGroups,
  })));
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
        isPrint
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
