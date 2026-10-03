import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewInvoiceClient } from "./new-invoice-client";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; source?: string }>;
}) {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  const { customerId, source } = await searchParams;

  const customers = companyId
    ? await prisma.customer.findMany({
        where: { companyId, NOT: { type: "LEVERANCIER" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, city: true },
      })
    : [];

  // ?source=quote:<id> komt van de knop "Factureren" op een offerte, calculatie of werkbon.
  const [type, id] = (source ?? "").split(":");
  const initialSource =
    (type === "quote" || type === "calculation" || type === "workorder") && id ? { type, id } as const : null;

  return <NewInvoiceClient customers={customers} initialCustomerId={customerId ?? null} initialSource={initialSource} />;
}
