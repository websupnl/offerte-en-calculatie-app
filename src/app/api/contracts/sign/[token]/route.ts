import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured, uploadObject } from "@/lib/storage";
import { sendTelegramMessage } from "@/lib/notifications";

export const runtime = "nodejs";

const schema = z.object({
  dataUrl: z.string().regex(/^data:image\/png;base64,/, "Verwacht PNG data-URL"),
  signedBy: z.string().min(2, "Vul je naam in"),
  agreed: z.literal(true),
});

/**
 * Publiek: de klant tekent op het geheime token. Geen login — zelfde geest als
 * het offerteportaal. Eén keer tekenen, daarna is het dicht.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const contract = await prisma.contract.findUnique({
    where: { shareToken: token },
    select: { id: true, number: true, title: true, status: true, signedAt: true, customer: { select: { name: true } } },
  });
  if (!contract || contract.status === "CONCEPT") {
    return NextResponse.json({ error: "Contract niet gevonden" }, { status: 404 });
  }
  if (contract.signedAt) {
    return NextResponse.json({ error: "Dit contract is al ondertekend" }, { status: 409 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" }, { status: 400 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Opslag niet beschikbaar" }, { status: 503 });
  }

  const bytes = Buffer.from(parsed.data.dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
  if (bytes.length > 2_000_000) {
    return NextResponse.json({ error: "Handtekening te groot" }, { status: 413 });
  }

  const key = `contracten/${contract.id}/handtekening.png`;
  await uploadObject(key, bytes, "image/png");

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      signatureKey: key,
      signedBy: parsed.data.signedBy,
      signedAt: new Date(),
      status: "GETEKEND",
      events: {
        create: {
          type: "SIGNED",
          actor: parsed.data.signedBy,
          detail: `Ondertekend via de tekenlink`,
        },
      },
    },
  });

  sendTelegramMessage(
    `✍️ <b>CONTRACT GETEKEND</b>\n📄 ${contract.number} — ${contract.title}\n👤 ${parsed.data.signedBy} (${contract.customer.name})`,
  ).catch(console.error);

  return NextResponse.json({ ok: true });
}
