import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureInvoicePaymentLink } from "@/lib/mollie-invoices";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: { company: { select: { slug: true } } },
  });
  if (!invoice) return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  if (!["GEREED", "VERZONDEN", "VERVALLEN"].includes(invoice.status)) {
    return NextResponse.json({ error: "Maak de factuur eerst definitief" }, { status: 409 });
  }
  if (Number(invoice.totalIncVat) <= 0) {
    return NextResponse.json({ error: "Het te betalen bedrag moet groter zijn dan nul" }, { status: 400 });
  }

  try {
    const { url, mode } = await ensureInvoicePaymentLink(invoice);
    return NextResponse.json({ url, mode });
  } catch (error) {
    console.error("Mollie-betaallink aanmaken mislukt:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Betaallink aanmaken mislukt" }, { status: 502 });
  }
}
