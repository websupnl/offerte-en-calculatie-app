import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Contract klaarzetten om te tekenen: status naar VERZONDEN en de tekenlink
 * teruggeven. Het versturen zelf doet Daan bewust zelf (mail/WhatsApp) — dan
 * staat er een persoonlijk bericht bij in plaats van een systeemmail.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id, companyId: session.user.activeCompanyId, deletedAt: null },
    select: { id: true, status: true, shareToken: true, body: true },
  });
  if (!contract) return NextResponse.json({ error: "Contract niet gevonden" }, { status: 404 });

  if (!contract.body?.trim()) {
    return NextResponse.json({ error: "Er staat nog geen tekst in het contract" }, { status: 400 });
  }
  if (contract.status === "GETEKEND" || contract.status === "ACTIEF") {
    return NextResponse.json({ error: "Dit contract is al getekend" }, { status: 409 });
  }

  const updated = await prisma.contract.update({
    where: { id },
    data: {
      status: "VERZONDEN",
      events: {
        create: { type: "SENT", actor: session.user.name ?? session.user.email ?? null },
      },
    },
    select: { shareToken: true },
  });

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  return NextResponse.json({ url: `${base}/c/${updated.shareToken}` });
}
