import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { syncQuoteTotalsFromCalculations } from "@/lib/quote-totals";

const schema = z.object({
  action: z.enum(["archive", "restore", "delete"]),
  ids: z.array(z.string().min(1)).min(1).max(200),
});

/** Meerdere calculaties tegelijk archiveren, terugzetten of verwijderen. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = session.user.activeCompanyId;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, ids } = parsed.data;

  const calcs = await prisma.calculation.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, quoteId: true },
  });
  if (calcs.length === 0) return NextResponse.json({ ok: true, affected: 0 });
  const calcIds = calcs.map((c) => c.id);
  const quoteIds = [...new Set(calcs.map((c) => c.quoteId).filter((q): q is string => Boolean(q)))];

  if (action === "archive" || action === "restore") {
    await prisma.calculation.updateMany({
      where: { id: { in: calcIds }, companyId },
      data: { archivedAt: action === "archive" ? new Date() : null },
    });
  } else {
    await prisma.calculation.deleteMany({ where: { id: { in: calcIds }, companyId } });
  }

  for (const quoteId of quoteIds) await syncQuoteTotalsFromCalculations(quoteId);

  return NextResponse.json({ ok: true, affected: calcIds.length });
}
