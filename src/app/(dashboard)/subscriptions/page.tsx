import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listBillingDue, subscriptionDto } from "@/lib/subscriptions/service";
import { SubscriptionsClient } from "./subscriptions-client";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;

  if (!companyId) {
    return <SubscriptionsClient initialSubscriptions={[]} due={[]} customers={[]} />;
  }

  const [rows, dueRows, customers] = await Promise.all([
    prisma.subscription.findMany({
      where: { companyId },
      orderBy: [{ status: "asc" }, { nextBillingDate: "asc" }],
      take: 500,
    }),
    listBillingDue(prisma, { companyIds: [companyId], withinDays: 30 }),
    prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 500,
    }),
  ]);

  return (
    <SubscriptionsClient
      initialSubscriptions={rows.map((row) => subscriptionDto(row))}
      due={dueRows.map((row) => subscriptionDto(row))}
      customers={customers}
    />
  );
}
