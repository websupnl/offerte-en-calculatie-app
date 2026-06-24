import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintOnLoad } from "@/components/print-on-load";
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/format";

export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { id } = await params;
  const { auto } = await searchParams;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, companyId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      company: true,
      customer: true,
      project: { select: { number: true, title: true } },
    },
  });
  if (!invoice) notFound();

  // Btw groeperen per tarief voor de specificatie.
  const vatGroups = new Map<number, { base: number; vat: number }>();
  for (const l of invoice.lines) {
    const rate = Number(l.vatRate);
    const base = Number(l.qty) * Number(l.unitPrice);
    const g = vatGroups.get(rate) ?? { base: 0, vat: 0 };
    g.base += base;
    g.vat += base * (rate / 100);
    vatGroups.set(rate, g);
  }
  const c = invoice.customer;

  return (
    <main className="inv-print">
      <PrintOnLoad enabled={auto === "1"} />
      <style>{`
        .inv-print { font-family: Arial, Helvetica, sans-serif; color: #111827; max-width: 800px; margin: 0 auto; padding: 40px; font-size: 13px; }
        .inv-print h1 { font-size: 22px; margin: 0; }
        .inv-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 20px; }
        .inv-meta { text-align: right; font-size: 12px; color: #374151; }
        .inv-meta div { margin-bottom: 2px; }
        .inv-grid { display: flex; justify-content: space-between; gap: 40px; margin-bottom: 24px; }
        .inv-grid h3 { font-size: 11px; text-transform: uppercase; color: #6b7280; margin: 0 0 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #d1d5db; padding: 6px 4px; }
        td { padding: 6px 4px; border-bottom: 1px solid #f3f4f6; }
        .num { text-align: right; white-space: nowrap; }
        .inv-totals { display: flex; justify-content: flex-end; }
        .inv-totals table { width: 280px; }
        .inv-totals td { border: none; padding: 3px 4px; }
        .inv-totals .grand { font-weight: bold; font-size: 15px; border-top: 2px solid #111827; padding-top: 8px; }
        .inv-notes { margin-top: 24px; color: #374151; white-space: pre-wrap; }
        @media print { .inv-print { padding: 20px; } }
      `}</style>

      <div className="inv-head">
        <div>
          <h1>Factuur</h1>
          <p style={{ margin: "4px 0 0", color: "#374151" }}>{invoice.company.name}</p>
        </div>
        <div className="inv-meta">
          <div><strong>{invoice.number}</strong></div>
          <div>{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</div>
          <div>Factuurdatum: {formatDate(invoice.invoiceDate)}</div>
          {invoice.dueDate && <div>Vervaldatum: {formatDate(invoice.dueDate)}</div>}
          {invoice.reference && <div>Referentie: {invoice.reference}</div>}
        </div>
      </div>

      <div className="inv-grid">
        <div>
          <h3>Factuuradres</h3>
          <div>{c?.name ?? "—"}</div>
          {c?.address && <div>{c.address}</div>}
          {(c?.zipCode || c?.city) && <div>{[c?.zipCode, c?.city].filter(Boolean).join(" ")}</div>}
          {c?.vatNumber && <div>Btw: {c.vatNumber}</div>}
        </div>
        {invoice.project && (
          <div style={{ textAlign: "right" }}>
            <h3>Project</h3>
            <div>{invoice.project.number}</div>
            <div>{invoice.project.title}</div>
          </div>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th>Omschrijving</th>
            <th className="num">Aantal</th>
            <th className="num">Eenheid</th>
            <th className="num">Prijs</th>
            <th className="num">Btw</th>
            <th className="num">Totaal</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l) => (
            <tr key={l.id}>
              <td>{l.description}</td>
              <td className="num">{Number(l.qty)}</td>
              <td className="num">{l.unit ?? ""}</td>
              <td className="num">{formatCurrency(Number(l.unitPrice))}</td>
              <td className="num">{Number(l.vatRate)}%</td>
              <td className="num">{formatCurrency(Number(l.qty) * Number(l.unitPrice))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inv-totals">
        <table>
          <tbody>
            <tr>
              <td>Subtotaal (excl. btw)</td>
              <td className="num">{formatCurrency(Number(invoice.totalExVat))}</td>
            </tr>
            {[...vatGroups.entries()].map(([rate, g]) => (
              <tr key={rate}>
                <td>Btw {rate}% over {formatCurrency(g.base)}</td>
                <td className="num">{formatCurrency(g.vat)}</td>
              </tr>
            ))}
            <tr className="grand">
              <td>Te betalen</td>
              <td className="num">{formatCurrency(Number(invoice.totalIncVat))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {invoice.notes && <div className="inv-notes">{invoice.notes}</div>}
      {invoice.dueDate && (
        <p style={{ marginTop: 24, color: "#374151" }}>
          Gelieve het bedrag voor {formatDate(invoice.dueDate)} over te maken onder vermelding
          van factuurnummer {invoice.number}.
        </p>
      )}
    </main>
  );
}
