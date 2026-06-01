import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAcceptedNotification } from "@/lib/email";

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

  await prisma.quoteShare.update({
    where: { token },
    data: { acceptedAt: new Date(), message },
  });

  await prisma.quote.update({
    where: { id: share.quoteId },
    data: { status: "ACCEPTED" },
  });

  // Notify company owner
  const settings = (share.quote.company.settings ?? {}) as Record<string, unknown>;
  const notifyEmail = (settings.notifyEmail as string | undefined) ?? (settings.emailFrom as string | undefined);
  if (notifyEmail) {
    await sendAcceptedNotification({
      to: notifyEmail,
      companyName: share.quote.company.name,
      customerName: share.quote.customer.name,
      quoteNumber: share.quote.number,
      message: message || undefined,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
