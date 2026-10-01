import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";
import { syncQuoteTotalsFromCalculations } from "@/lib/quote-totals";

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


  const quote = await prisma.quote.create({
    data: {
      companyId,
      customerId: calculation.customerId,
      createdById: session.user.id,
      title: calculation.title,
      notes: calculation.notes,
      vatRate: calculation.vatRate,
      projectId: calculation.projectId,
    },
    include: { customer: true },
  });

  // Link Quote to Calculation and update status to QUOTED
  await prisma.calculation.update({
    where: { id: calculation.id },
    data: {
      quoteId: quote.id,
      status: "QUOTED",
    },
  });

  await syncQuoteTotalsFromCalculations(quote.id);

  const host = req.headers.get("host") ?? "localhost:3000";
  const cookie = req.headers.get("cookie") ?? "";
  after(async () => {
    await generateAndStorePdf(quote.id, host, cookie);
  });

  return NextResponse.json({ quote, calculationId: calculation.id }, { status: 201 });
}
