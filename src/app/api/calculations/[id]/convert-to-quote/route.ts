import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";
import { syncQuoteTotalsFromCalculations } from "@/lib/quote-totals";
import { createDocumentProject } from "@/lib/document-project";

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


  const customerId = calculation.customerId;
  const quote = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Calculation" WHERE "id" = ${id} FOR UPDATE`;
    const current = await tx.calculation.findUniqueOrThrow({ where: { id }, include: { quote: true } });
    // Een calculatie heeft één actieve offerte. Nooit stil naar een nieuwe verplaatsen.
    if (current.quote && !current.quote.archivedAt) return current.quote;
    const projectId = calculation.projectId ?? (await createDocumentProject(tx, {
      companyId, customerId, title: calculation.title, description: calculation.description,
    })).id;
    const createdQuote = await tx.quote.create({
    data: {
      companyId,
      customerId,
      createdById: session.user.id,
      title: calculation.title,
      notes: calculation.notes,
      vatRate: calculation.vatRate,
      projectId,
    },
    include: { customer: true },
    });

  // Link Quote to Calculation and update status to QUOTED
    await tx.calculation.update({
    where: { id: calculation.id },
    data: {
      quoteId: createdQuote.id,
      projectId,
      status: "QUOTED",
    },
    });
    await syncQuoteTotalsFromCalculations(createdQuote.id, tx);
    return createdQuote;
  });

  const host = req.headers.get("host") ?? "localhost:3001";
  const cookie = req.headers.get("cookie") ?? "";
  after(async () => {
    await generateAndStorePdf(quote.id, host, cookie);
  });

  return NextResponse.json({ quote, calculationId: calculation.id }, { status: calculation.quoteId === quote.id ? 200 : 201 });
}
