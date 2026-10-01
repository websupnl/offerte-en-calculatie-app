import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ create?: string }> }) {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;

  const customers = companyId
    ? await prisma.customer.findMany({
        where: { companyId },
        orderBy: { name: "asc" },
        include: { _count: { select: { quotes: true } } },
        take: 200,
      })
    : [];

  const createOpen = (await searchParams).create === "1";
  return <CustomersClient key={String(createOpen)} initialCustomers={customers} initialCreateOpen={createOpen} />;
}
