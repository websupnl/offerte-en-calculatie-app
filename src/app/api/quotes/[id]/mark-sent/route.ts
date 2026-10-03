import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextQuoteNumber } from "@/lib/quote-number";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";

/** Registreert verzending buiten de app; verstuurt zelf geen bericht. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.activeCompanyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const companyId = session.user.activeCompanyId;

  const result = await prisma.$transaction(async (tx) => {
    // Serieel nummeren binnen dit bedrijf, en dubbel klikken op dezelfde
    // offerte levert hooguit één verzending en één gebeurtenis op.
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Quote" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
    const quote = await tx.quote.findFirst({
      where: { id, companyId, archivedAt: null },
      include: { company: { select: { slug: true } } },
    });
    if (!quote) return { error: "Offerte niet gevonden", status: 404 };
    if (quote.status === "SENT" || quote.status === "VIEWED") {
      return { number: quote.number, quoteStatus: quote.status, changed: false };
    }
    if (quote.status !== "DRAFT") {
      return { error: "Alleen een concept kan als verstuurd worden gemarkeerd.", status: 409 };
    }
    const number = quote.number ?? await nextQuoteNumber(companyId, quote.company.slug, tx);
    const now = new Date();
    await tx.quote.update({
      where: { id },
      data: {
        number, status: "SENT", sentAt: quote.sentAt ?? now,
        lastSentAt: now, sendCount: { increment: 1 }, pdfUrl: null,
      },
    });
    await tx.quoteShare.updateMany({ where: { quoteId: id }, data: { portalPdfUrl: null } });
    await tx.quoteEvent.create({
      data: {
        quoteId: id, type: "SENT",
        actor: session.user.name ?? session.user.email ?? undefined,
        detail: "Handmatig als verstuurd gemarkeerd (buiten de app gedeeld)",
      },
    });
    return { number, quoteStatus: "SENT", changed: true };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.changed) {
    const host = req.headers.get("host") ?? "localhost:3001";
    const cookie = req.headers.get("cookie") ?? "";
    after(async () => { await generateAndStorePdf(id, host, cookie); });
  }
  return NextResponse.json({ number: result.number, status: result.quoteStatus });
}
