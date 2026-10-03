import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInvoiceSettings } from "@/lib/branding";
import { InvoiceDetailClient } from "./invoice-detail-client";
import { invoiceMollieKey, invoiceMollieMode } from "@/lib/mollie-invoices";
import { invoiceEmailConfigured } from "@/lib/email";
import { markOverdueInvoices } from "@/lib/invoice-overdue";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  await markOverdueInvoices(companyId, id);

  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, companyId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      customer: true,
      project: { select: { id: true, number: true, title: true } },
      quote: { select: { id: true, number: true } },
      workOrder: { select: { id: true, number: true } },
      company: { select: { settings: true, slug: true } },
    },
  });
  if (!invoice) notFound();

  const s = getInvoiceSettings(invoice.company.settings);
  const missing = [
    !s.address && "bedrijfsadres",
    !s.kvk && "KvK-nummer",
    !s.vatNumber && "btw-id",
  ].filter(Boolean) as string[];

  const key = invoiceMollieKey(invoice.company.slug);
  let mollieLive = false;
  try { mollieLive = Boolean(key && invoiceMollieMode(key) === "live"); } catch { /* ongeldige key */ }
  return <InvoiceDetailClient invoice={JSON.parse(JSON.stringify({ ...invoice, company: undefined }))} missingCompanyData={missing} mollieConfigured={Boolean(key)} mollieLive={mollieLive} emailConfigured={invoiceEmailConfigured()} />;
}
