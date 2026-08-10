import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuoteNumber } from "@/lib/format";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;

  const calculation = await prisma.calculation.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!calculation) {
    return NextResponse.json({ error: "Calculatie niet gevonden" }, { status: 404 });
  }

  if (!calculation.customerId) {
    return NextResponse.json(
      { error: "Koppel eerst een klant aan deze calculatie om een offerte aan te maken" },
      { status: 400 },
    );
  }

  const count = await prisma.quote.count({ where: { companyId } });
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const quoteNumber = generateQuoteNumber(company?.slug ?? "xx", count + 1);

  // Verplichte regels worden gewone QuoteItems; optionele regels worden offerte-opties
  // (Quote.options), zodat ze als losse meerprijs zichtbaar zijn en niet meetellen in het totaal.
  const mainItems = calculation.items.filter((item) => !item.optional);
  const optionalItems = calculation.items.filter((item) => item.optional && !item.hiddenOnQuote);

  const quoteItemsData = mainItems.map((item, index) => {
    const total = Number(item.totalSalesPrice);
    return {
      productId: item.productId,
      description: item.description,
      qty: item.qty,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
      vatRate: item.vatRate,
      total,
      sortOrder: index,
      indent: 0,
      type: "main",
      hiddenOnQuote: item.hiddenOnQuote,
    };
  });

  const quoteOptions = optionalItems.map((item) => ({
    id: item.id,
    t: item.description,
    d: `${item.qty} × ${item.unit ?? "stuk"}`,
    tag: "Optioneel",
    price: Number(item.unitPrice) * Number(item.qty),
    vatRate: Number(item.vatRate),
    required: false,
    details: [],
  }));

  const totalExVat = Number(calculation.totalSalesPrice);
  const totalVat = Math.round(totalExVat * (Number(calculation.vatRate) / 100) * 100) / 100;
  const totalIncVat = totalExVat + totalVat;

  const quote = await prisma.quote.create({
    data: {
      companyId,
      customerId: calculation.customerId,
      createdById: session.user.id,
      number: quoteNumber,
      title: calculation.title,
      notes: calculation.notes,
      vatRate: calculation.vatRate,
      totalExVat,
      totalVat,
      totalIncVat,
      projectId: calculation.projectId,
      options: quoteOptions,
      items: {
        create: quoteItemsData,
      },
    },
    include: {
      customer: true,
      items: true,
    },
  });

  // Link Quote to Calculation and update status to QUOTED
  await prisma.calculation.update({
    where: { id: calculation.id },
    data: {
      quoteId: quote.id,
      status: "QUOTED",
    },
  });

  const host = req.headers.get("host") ?? "localhost:3000";
  const cookie = req.headers.get("cookie") ?? "";
  after(async () => {
    await generateAndStorePdf(quote.id, host, cookie);
  });

  return NextResponse.json({ quote, calculationId: calculation.id }, { status: 201 });
}
