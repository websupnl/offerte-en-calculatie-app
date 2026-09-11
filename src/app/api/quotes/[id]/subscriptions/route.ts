import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSubscriptionsForQuote } from "@/lib/subscriptions/from-quote";
import { subscriptionDto } from "@/lib/subscriptions/service";

/** Abonnementen die uit deze offerte zijn ontstaan. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) {
    return NextResponse.json({ error: "Geen actief bedrijf" }, { status: 401 });
  }
  const { id } = await params;

  const rows = await prisma.subscription.findMany({
    where: { sourceQuoteId: id, companyId: session.user.activeCompanyId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(rows.map((row) => subscriptionDto(row)));
}

/**
 * Abonnementen (opnieuw) genereren voor een geaccepteerde offerte. Idempotent —
 * bestaande abonnementen blijven ongemoeid, alleen ontbrekende worden aangemaakt.
 * Vangnet als de automatische aanmaak bij het akkoord faalde.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) {
    return NextResponse.json({ error: "Geen actief bedrijf" }, { status: 401 });
  }
  const { id } = await params;

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: { id: true, status: true },
  });
  if (!quote) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  if (quote.status !== "ACCEPTED") {
    return NextResponse.json(
      { error: "Alleen een geaccepteerde offerte levert abonnementen op." },
      { status: 409 },
    );
  }

  const result = await syncSubscriptionsForQuote(prisma, id, {
    actor: session.user.name ?? "onbekend",
  });
  return NextResponse.json(result);
}
