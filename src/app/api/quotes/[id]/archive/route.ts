import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ archived: z.boolean() });

/**
 * Offerte archiveren of terugzetten. Archiveren verbergt hem uit de werklijsten
 * en de cijfers, maar bewaart alles. Een geaccepteerde offerte blijft vergrendeld
 * (zelfde regel als de PUT).
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

  const quote = await prisma.quote.findFirst({
    where: { id, companyId },
    select: { id: true, status: true, archivedAt: true },
  });
  if (!quote) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  if (quote.status === "ACCEPTED") {
    return NextResponse.json({ error: "Een geaccepteerde offerte is vergrendeld." }, { status: 409 });
  }

  await prisma.quote.update({
    where: { id },
    data: { archivedAt: parsed.data.archived ? new Date() : null },
  });

  return NextResponse.json({ ok: true, archived: parsed.data.archived });
}
