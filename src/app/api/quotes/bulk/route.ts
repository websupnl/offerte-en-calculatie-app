import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { del } from "@vercel/blob";
import { isStorageConfigured, deleteObject } from "@/lib/storage";
import { getQuoteAttachmentStorageKey } from "@/lib/quote-attachments";

const schema = z.object({
  action: z.enum(["archive", "restore", "delete"]),
  ids: z.array(z.string().min(1)).min(1).max(200),
});

/**
 * Meerdere offertes tegelijk archiveren, terugzetten of verwijderen.
 * Zelfde regels als de losse acties: een geaccepteerde offerte blijft
 * vergrendeld en wordt overgeslagen.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = session.user.activeCompanyId;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, ids } = parsed.data;

  const quotes = await prisma.quote.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, status: true, pdfUrl: true, attachments: { select: { imageUrl: true } } },
  });
  const allowed = quotes.filter((q) => q.status !== "ACCEPTED");
  const skipped = quotes.length - allowed.length;
  const allowedIds = allowed.map((q) => q.id);

  if (allowedIds.length === 0) {
    return NextResponse.json({ ok: true, affected: 0, skipped });
  }

  if (action === "archive" || action === "restore") {
    const result = await prisma.quote.updateMany({
      where: { id: { in: allowedIds }, companyId },
      data: { archivedAt: action === "archive" ? new Date() : null },
    });
    return NextResponse.json({ ok: true, affected: result.count, skipped });
  }

  // delete
  await prisma.quote.deleteMany({ where: { id: { in: allowedIds }, companyId } });
  for (const q of allowed) {
    if (q.pdfUrl) await del(q.pdfUrl).catch((e) => console.error("[BULK] blob:", e));
    if (isStorageConfigured()) {
      for (const a of q.attachments) {
        const key = getQuoteAttachmentStorageKey(a.imageUrl);
        if (key) await deleteObject(key).catch((e) => console.error("[BULK] attachment:", e));
      }
    }
  }
  return NextResponse.json({ ok: true, affected: allowedIds.length, skipped });
}
