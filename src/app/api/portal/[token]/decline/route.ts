import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDeclinedNotification } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { message } = await req.json().catch(() => ({ message: "" }));

  const share = await prisma.quoteShare.findUnique({
    where: { token },
    include: {
      quote: {
        include: {
          customer: true,
          company: true,
        },
      },
    },
  });
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.quoteShare.update({
      where: { token },
      data: { declinedAt: new Date(), message },
    }),
    prisma.quote.update({
      where: { id: share.quoteId },
      data: { status: "DECLINED" },
    }),
    prisma.quoteEvent.create({
      data: {
        quoteId: share.quoteId,
        type: "DECLINED",
        detail: message || undefined,
      },
    }),
  ]);

  // Notify company owner via Email
  const settings = (share.quote.company.settings ?? {}) as Record<string, unknown>;
  const notifyEmail = (settings.notifyEmail as string | undefined) ?? (settings.emailFrom as string | undefined);
  if (notifyEmail) {
    await sendDeclinedNotification({
      to: notifyEmail,
      companySlug: share.quote.company.slug,
      customerName: share.quote.customer.name,
      quoteNumber: share.quote.number,
      message: message || undefined,
    }).catch(() => {});
  }

  // Notify company owner via Telegram
  const telegramMsg = `
❌ <b>OFFERTE AFGEWEZEN</b>
👤 <b>Klant:</b> ${share.quote.customer.name}
📄 <b>Offerte:</b> ${share.quote.number}
💬 <b>Reden:</b> ${message || "Geen reden opgegeven"}
  `.trim();
  
  const { sendTelegramMessage } = await import("@/lib/notifications");
  sendTelegramMessage(telegramMsg).catch(console.error);


  return NextResponse.json({ ok: true });
}
