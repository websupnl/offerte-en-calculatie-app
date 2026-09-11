import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscriptionDto } from "@/lib/subscriptions/service";
import { SubscriptionDetailClient } from "./subscription-detail-client";

export const dynamic = "force-dynamic";

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  const row = await prisma.subscription.findFirst({
    where: { id, companyId },
    include: {
      events: { orderBy: { occurredAt: "desc" } },
      quote: { select: { id: true, number: true, title: true } },
      customer: { select: { id: true, name: true, email: true } },
    },
  });
  if (!row) notFound();

  const agreementLogs = row.sourceQuoteId
    ? await prisma.agreementLog.findMany({
        where: { quoteId: row.sourceQuoteId },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true, method: true, avVersion: true, ip: true },
      })
    : [];

  return (
    <SubscriptionDetailClient
      subscription={subscriptionDto(row)}
      history={
        row.events.map((e) => ({
          type: e.type,
          detail: e.detail,
          amountCents: e.amountCents === null ? null : Number(e.amountCents),
          periodStart: e.periodStart ? e.periodStart.toISOString().slice(0, 10) : null,
          periodEnd: e.periodEnd ? e.periodEnd.toISOString().slice(0, 10) : null,
          actor: e.actor,
          occurredAt: e.occurredAt.toISOString(),
        }))
      }
      quote={row.quote}
      customer={row.customer}
      agreementLogs={agreementLogs.map((a) => ({
        occurredAt: a.occurredAt.toISOString(),
        method: a.method,
        avVersion: a.avVersion,
        ip: a.ip,
      }))}
    />
  );
}
