import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuoteNumber } from "@/lib/format";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;

  const source = await prisma.quote.findFirst({
    where: { id, companyId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      attachments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const count = await prisma.quote.count({ where: { companyId } });
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const number = generateQuoteNumber(company?.slug ?? "xx", count + 1);

  const duplicate = await prisma.quote.create({
    data: {
      companyId,
      customerId: source.customerId,
      createdById: session.user.id,
      number,
      title: source.title,
      category: source.category,
      tagline: source.tagline,
      itemsHeader: source.itemsHeader,
      status: "DRAFT",
      quoteType: source.quoteType,
      validUntil: source.validUntil,
      intro: source.intro,
      outro: source.outro,
      notes: source.notes,
      vatRate: source.vatRate,
      discount: source.discount,
      flow: source.flow ?? undefined,
      approach: source.approach ?? undefined,
      options: source.options ?? undefined,
      exclusions: source.exclusions ?? undefined,
      assumptions: source.assumptions ?? undefined,
      technicalNotes: source.technicalNotes ?? undefined,
      customerResponsibilities: source.customerResponsibilities ?? undefined,
      planning: source.planning ?? undefined,
      commercial: source.commercial ?? undefined,
      batteryAdvice: source.batteryAdvice ?? undefined,
      choiceGroups: source.choiceGroups ?? undefined,
      internalAdvice: source.internalAdvice,
      document: source.document ?? undefined,
      documentRevision: 0,
      totalExVat: source.totalExVat,
      totalVat: source.totalVat,
      totalIncVat: source.totalIncVat,
      items: source.items.length
        ? {
            create: source.items.map((item) => ({
              productId: item.productId,
              description: item.description,
              qty: item.qty,
              unitPrice: item.unitPrice,
              costPrice: item.costPrice,
              vatRate: item.vatRate,
              total: item.total,
              sortOrder: item.sortOrder,
              indent: item.indent,
              type: item.type,
              choiceGroupId: item.choiceGroupId,
              hiddenOnQuote: item.hiddenOnQuote,
            })),
          }
        : undefined,
      attachments: source.attachments.length
        ? {
            create: source.attachments.map((attachment) => ({
              title: attachment.title,
              imageUrl: attachment.imageUrl,
              liveUrl: attachment.liveUrl,
              caption: attachment.caption,
              section: attachment.section,
              sortOrder: attachment.sortOrder,
            })),
          }
        : undefined,
    },
    include: { customer: true, items: true, attachments: { orderBy: { sortOrder: "asc" } } },
  });

  const host = req.headers.get("host") ?? "localhost:3000";
  const cookie = req.headers.get("cookie") ?? "";
  after(async () => {
    await generateAndStorePdf(duplicate.id, host, cookie);
  });

  return NextResponse.json(duplicate, { status: 201 });
}
