import { notFound } from "next/navigation";
import { Bricolage_Grotesque, Nunito, Sora } from "next/font/google";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintOnLoad } from "@/components/print-on-load";
import { InvoiceDocument, type InvoiceVariant } from "@/components/invoice/invoice-document";
import { getInvoiceBrand, readInvoiceSettings } from "@/lib/invoice-company";
import { invoiceVariant } from "@/lib/invoice-status";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--inv-bricolage" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--inv-nunito" });
const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--inv-sora" });

export const dynamic = "force-dynamic";

/** "18 sep 2026" */
const shortDate = (d: Date) =>
  new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" })
    .format(d)
    .replace(".", "");

/** "3 aug t/m 16 sep 2026", jaar alleen aan het eind als het hetzelfde is. */
function periodLabel(start: Date, end: Date): string {
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const from = sameYear
    ? new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" }).format(start).replace(".", "")
    : shortDate(start);
  return `${from} t/m ${shortDate(end)}`;
}

const VARIANTS: InvoiceVariant[] = ["concept", "open", "herinnering", "betaald"];

export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string; variant?: string }>;
}) {
  const { id } = await params;
  const { auto, variant: variantParam } = await searchParams;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, companyId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      company: true,
      customer: true,
      quote: { select: { number: true } },
    },
  });
  if (!invoice) notFound();

  const brand = getInvoiceBrand(invoice.company.slug);
  const company = readInvoiceSettings(invoice.company.settings);

  const termDays = invoice.dueDate
    ? Math.max(0, Math.round((invoice.dueDate.getTime() - invoice.invoiceDate.getTime()) / 86_400_000))
    : company.paymentTermDays;

  const meta: [string, string][] = [["Factuurdatum", shortDate(invoice.invoiceDate)]];
  if (invoice.dueDate) meta.push(["Vervaldatum", shortDate(invoice.dueDate)]);
  if (invoice.periodStart && invoice.periodEnd) meta.push(["Periode", periodLabel(invoice.periodStart, invoice.periodEnd)]);
  else if (invoice.periodEnd) meta.push(["Leverdatum", shortDate(invoice.periodEnd)]);
  if (invoice.quote?.number) meta.push(["Offerte", invoice.quote.number]);
  if (invoice.reference) meta.push([brand.informal ? "Jouw referentie" : "Uw referentie", invoice.reference]);

  const variant =
    variantParam && VARIANTS.includes(variantParam as InvoiceVariant)
      ? (variantParam as InvoiceVariant)
      : invoiceVariant(invoice);

  return (
    <main>
      <PrintOnLoad enabled={auto === "1"} />
      <InvoiceDocument
        fontClassName={`${bricolage.variable} ${nunito.variable} ${sora.variable}`}
        data={{
          number: invoice.number,
          subject: invoice.subject,
          variant,
          brand,
          company,
          customer: {
            name: invoice.customer.name,
            address: invoice.customer.address,
            zipCode: invoice.customer.zipCode,
            city: invoice.customer.city,
            vatNumber: invoice.customer.vatNumber,
          },
          meta,
          intro: invoice.intro,
          closing: invoice.notes,
          termDays,
          dueDateLabel: invoice.dueDate ? shortDate(invoice.dueDate) : null,
          paidAtLabel: invoice.paidAt ? shortDate(invoice.paidAt) : null,
          lines: invoice.lines.map((l) => ({
            description: l.description,
            detail: l.detail,
            qty: Number(l.qty),
            unit: l.unit,
            unitPrice: Number(l.unitPrice),
            vatRate: Number(l.vatRate),
            groupLabel: l.groupLabel,
          })),
        }}
      />
    </main>
  );
}
