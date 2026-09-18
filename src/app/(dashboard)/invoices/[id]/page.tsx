import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { missingInvoiceSettings, readInvoiceSettings } from "@/lib/invoice-company";
import { InvoiceDetailClient } from "./invoice-detail-client";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, companyId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      customer: true,
      project: { select: { id: true, number: true, title: true } },
      quote: { select: { id: true, number: true } },
      company: { select: { settings: true } },
    },
  });
  if (!invoice) notFound();

  const { company, ...rest } = invoice;
  const missing = missingInvoiceSettings(readInvoiceSettings(company.settings));

  return <InvoiceDetailClient invoice={JSON.parse(JSON.stringify(rest))} missingSettings={missing} />;
}
