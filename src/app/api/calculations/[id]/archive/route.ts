import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { syncQuoteTotalsFromCalculations } from "@/lib/quote-totals";

const schema = z.object({ archived: z.boolean() });

/**
 * Calculatie archiveren of terugzetten. Een gearchiveerde calculatie telt niet
 * meer mee in het offertetotaal, dus na de wijziging trekken we dat gelijk.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const companyId = session.user.activeCompanyId;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige body", details: parsed.error.flatten() }, { status: 400 });
  }

  const calc = await prisma.calculation.findFirst({
    where: { id, companyId },
    select: { id: true, quoteId: true },
  });
  if (!calc) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  await prisma.calculation.update({
    where: { id },
    data: { archivedAt: parsed.data.archived ? new Date() : null },
  });

  await syncQuoteTotalsFromCalculations(calc.quoteId);

  return NextResponse.json({ ok: true, archived: parsed.data.archived });
}
