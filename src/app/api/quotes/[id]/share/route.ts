import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendQuoteEmail } from "@/lib/email";
import { formatDate } from "@/lib/format";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: {
      customer: true,
      company: true,
    },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const share = await prisma.quoteShare.upsert({
    where: { quoteId: id },
    create: { quoteId: id },
    update: {},
  });

  if (quote.status === "DRAFT") {
    await prisma.quote.update({ where: { id }, data: { status: "SENT" } });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${appUrl}/q/${share.token}`;

  // Send email if customer has an email address
  if (quote.customer.email) {
    const settings = (quote.company.settings ?? {}) as Record<string, unknown>;
    const companyEmail = (settings.emailFrom as string | undefined) ?? `noreply@${quote.company.slug}.nl`;

    await sendQuoteEmail({
      to: quote.customer.email,
      customerName: quote.customer.name,
      companyName: quote.company.name,
      companyEmail,
      quoteNumber: quote.number,
      quoteUrl: url,
      validUntil: quote.validUntil ? formatDate(quote.validUntil) : undefined,
    }).catch(() => {
      // Don't fail the request if email fails
    });
  }

  return NextResponse.json({ token: share.token, url });
}
