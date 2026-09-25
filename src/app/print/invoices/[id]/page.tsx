import "@/app/q/[token]/portal.css";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintOnLoad } from "@/components/print-on-load";
import { getInvoiceSettings } from "@/lib/branding";
import { formatCurrency, formatDate } from "@/lib/format";

/**
 * Factuur in dezelfde huisstijl als de offerte: dezelfde portal.css, dezelfde
 * kleurverlopen, logo's, koppen, tabel en voettekst. Verander je het
 * offertedesign, dan beweegt de factuur mee.
 */
const BRAND = {
  websup: { website: "websup.nl", email: "info@websup.nl", phone: "06 82 20 21 48" },
  koolhaas: { website: "koolhaasinstallaties.nl", email: "info@koolhaasinstallaties.nl", phone: "06 82 20 21 48" },
} as const;

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

  const isKoolhaas = invoice.company.slug === "koolhaas";
  const brand = isKoolhaas ? BRAND.koolhaas : BRAND.websup;
  const s = getInvoiceSettings(invoice.company.settings);

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
  const paid = invoice.status === "BETAALD";
  const qty = (n: number) => n.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
  const missing = <span className="inv-warn">ontbreekt</span>;

  return (
    <main className="print-document-page">
      <PrintOnLoad enabled={auto === "1"} />
      <style>{`
        .inv-toolbar { width: 210mm; margin: 20px auto 16px; display: flex; justify-content: flex-end; gap: 8px; font-family: var(--font-body), system-ui, sans-serif; }
        .inv-toolbar a, .inv-toolbar button { border: 0; border-radius: 9999px; padding: 10px 18px; font-weight: 700; font-size: 14px; cursor: pointer; text-decoration: none; background: #fff; color: #0b1526; box-shadow: inset 0 0 0 1px rgba(11,21,38,.14); }
        .inv-toolbar button { background: #0b1526; color: #fff; box-shadow: none; }

        .sheet.inv-sheet { height: auto; min-height: 297mm; overflow: visible; }
        .inv-sheet .pad { min-height: 297mm; height: auto; }
        .inv-sheet .bar { height: 6px; }

        .inv-hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin: 18px 0 22px; }
        .inv-h1 { font: 800 64px/.9 var(--display); letter-spacing: -.04em; margin: 8px 0 0; padding-bottom: 4px;
          background: var(--grad-text); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .inv-meta { margin: 0; display: grid; grid-template-columns: auto auto; gap: 4px 16px; font-size: 14px; padding-left: 16px; border-left: 1px solid var(--border-str); }
        .inv-meta dt { color: var(--on-s); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; font-size: 12px; align-self: center; }
        .inv-meta dd { margin: 0; color: var(--on); font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }

        .inv-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .inv-party { background: var(--surface-in); border-radius: var(--r-lg); padding: 16px 18px; font-size: 14px; color: var(--on-m); line-height: 1.5; white-space: pre-line; }
        .inv-party small { display: block; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; }
        .inv-party b { display: block; font: 800 18px/1.2 var(--display); color: var(--on); margin-bottom: 4px; letter-spacing: -.01em; }

        .inv-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .inv-table th { padding: 8px 10px; text-align: left; font: 800 11px/1 var(--text); letter-spacing: .1em; text-transform: uppercase; color: var(--on-m); border-bottom: 1px solid var(--border-str); }
        .inv-table td { padding: 11px 10px; border-bottom: 1px solid var(--border); color: var(--on); line-height: 1.4; vertical-align: top; }
        .inv-table th:first-child, .inv-table td:first-child { padding-left: 16px; }
        .inv-table th:last-child, .inv-table td:last-child { padding-right: 16px; }
        .inv-table tbody tr { break-inside: avoid; }
        .inv-desc { white-space: pre-line; color: var(--on-m); }
        .inv-desc::first-line { color: var(--on); font-weight: 700; }
        .inv-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .inv-soft { color: var(--on-s); }
        .inv-table tfoot td { border: 0; padding-top: 6px; padding-bottom: 6px; font-variant-numeric: tabular-nums; }
        .inv-table tfoot .inv-first td { padding-top: 16px; }
        .inv-table tfoot .grand-total td { padding-top: 14px; padding-bottom: 14px; font: 800 20px/1 var(--display); background: var(--accent-bg); color: var(--on); }

        .inv-pay { margin-top: 22px; display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center;
          background: var(--grad-soft); border-radius: var(--r-lg); padding: 18px 20px; break-inside: avoid; }
        .inv-pay p { margin: 8px 0 0; font-size: 14px; color: var(--on-m); line-height: 1.5; }
        .inv-pay dl { margin: 0; display: grid; grid-template-columns: auto auto; gap: 3px 14px; font-size: 14px; }
        .inv-pay dt { color: var(--on-s); }
        .inv-pay dd { margin: 0; font-weight: 700; color: var(--on); }
        .inv-notes { margin-top: 18px; font-size: 14px; color: var(--on-m); white-space: pre-line; line-height: 1.55; }
        .inv-custom { margin-top: auto; padding: 18px 0 10px; font-size: 12px; color: var(--on-s); white-space: pre-line; }
        .inv-stamp { position: absolute; top: 150px; right: 64px; transform: rotate(-8deg); border: 3px solid #12b76a; color: #12b76a;
          font: 800 28px/1 var(--display); letter-spacing: .14em; padding: 8px 18px; border-radius: 10px; opacity: .85; }
        .inv-warn { color: #d92d20; font-weight: 700; }
        @media screen and (max-width: 820px) { .inv-toolbar { width: auto; margin: 12px; } }
        @media print {
          .inv-toolbar { display: none; }
          .sheet.inv-sheet { height: auto !important; min-height: 297mm; }
          .inv-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="inv-toolbar">
        <a href={`/invoices/${invoice.id}`}>Terug naar bewerken</a>
        <button type="button" data-print>Opslaan als PDF</button>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.querySelector('[data-print]')?.addEventListener('click',()=>window.print());document.title=${JSON.stringify(`Factuur ${invoice.number} - ${c?.name ?? ""}`)};`,
        }}
      />

      <div className={`portal-container ${isKoolhaas ? "portal-koolhaas" : "portal-websup"}`} style={{ minHeight: "auto", backgroundColor: "transparent" }}>
        <div className="doc-viewer" style={{ paddingBottom: 0 }}>
          <section className="sheet inv-sheet">
            <div className="bar"></div>
            {paid && <div className="inv-stamp">BETAALD</div>}
            <div className="pad">
              <div className="ph">
                {isKoolhaas ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vaste documentlayout, zelfde als de offerte
                  <img src="/logos/koolhaas-logo-tight.png" alt="Koolhaas Installaties" className="brand-logo" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- vaste documentlayout, zelfde als de offerte
                  <img src="/logos/websup-cover.png" alt="WebsUp" className="brand-logo" />
                )}
                <div className="ph-meta">
                  {invoice.number} &nbsp;&middot;&nbsp; {c?.name ?? "Klant"}
                </div>
              </div>

              <div className="inv-hero">
                <div>
                  <span className="eyebrow">{invoice.project ? invoice.project.title : isKoolhaas ? "Installatie" : "Diensten"}</span>
                  <h1 className="inv-h1">Factuur</h1>
                </div>
                <dl className="inv-meta">
                  <dt>Factuurnummer</dt><dd>{invoice.number}</dd>
                  <dt>Factuurdatum</dt><dd>{formatDate(invoice.invoiceDate)}</dd>
                  {invoice.dueDate && <><dt>Vervaldatum</dt><dd>{formatDate(invoice.dueDate)}</dd></>}
                  {invoice.project && <><dt>Project</dt><dd>{invoice.project.number}</dd></>}
                </dl>
              </div>

              <div className="inv-parties">
                <div className="inv-party">
                  <small>Factuur aan</small>
                  <b>{c?.name ?? "—"}</b>
                  {[c?.address, [c?.zipCode, c?.city].filter(Boolean).join(" ")].filter(Boolean).join("\n")}
                  {c?.kvk ? `\nKvK ${c.kvk}` : ""}
                  {c?.vatNumber ? `\nBtw-id ${c.vatNumber}` : ""}
                </div>
                <div className="inv-party">
                  <small>Van</small>
                  <b>{invoice.company.name}</b>
                  {s.address || <span className="inv-warn">Bedrijfsadres ontbreekt</span>}
                  {`\n${brand.email} · ${brand.phone}`}
                </div>
              </div>

              {invoice.reference && (
                <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--on-m)" }}>
                  <b style={{ color: "var(--on)" }}>Betreft:</b> {invoice.reference}
                </p>
              )}

              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Omschrijving</th>
                    <th className="inv-num">Aantal</th>
                    <th className="inv-num">Prijs</th>
                    <th className="inv-num">Btw</th>
                    <th className="inv-num">Bedrag</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="inv-desc">{l.description}</td>
                      <td className="inv-num">{qty(Number(l.qty))} <span className="inv-soft">{l.unit ?? ""}</span></td>
                      <td className="inv-num">{formatCurrency(Number(l.unitPrice))}</td>
                      <td className="inv-num inv-soft">{Number(l.vatRate)}%</td>
                      <td className="inv-num">{formatCurrency(Number(l.qty) * Number(l.unitPrice))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="inv-first">
                    <td colSpan={4} className="inv-num inv-soft">Subtotaal excl. btw</td>
                    <td className="inv-num">{formatCurrency(Number(invoice.totalExVat))}</td>
                  </tr>
                  {[...vatGroups.entries()].sort((a, b) => b[0] - a[0]).map(([rate, g]) => (
                    <tr key={rate}>
                      <td colSpan={4} className="inv-num inv-soft">Btw {rate}% over {formatCurrency(g.base)}</td>
                      <td className="inv-num">{formatCurrency(g.vat)}</td>
                    </tr>
                  ))}
                  <tr className="grand-total">
                    <td colSpan={4} className="inv-num">{paid ? "Totaal betaald" : "Te betalen"}</td>
                    <td className="inv-num">{formatCurrency(Number(invoice.totalIncVat))}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="inv-pay">
                <div>
                  <span className="eyebrow">{paid ? "Betaald" : "Betalen"}</span>
                  {paid ? (
                    <p>Deze factuur is betaald. Bedankt!</p>
                  ) : (
                    <p>
                      Maak het bedrag {invoice.dueDate ? <>vóór <b>{formatDate(invoice.dueDate)}</b></> : `binnen ${s.paymentDays} dagen`} over
                      onder vermelding van het factuurnummer.
                    </p>
                  )}
                </div>
                <dl>
                  <dt>IBAN</dt><dd>{s.iban || missing}</dd>
                  <dt>T.n.v.</dt><dd>{s.accountHolder || invoice.company.name}</dd>
                  <dt>Kenmerk</dt><dd>{invoice.number}</dd>
                </dl>
              </div>

              {invoice.notes && <div className="inv-notes">{invoice.notes}</div>}
              <div className="inv-custom">{s.footer}</div>

              <div className="doc-foot">
                {isKoolhaas ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vaste documentlayout, zelfde als de offerte
                  <img src="/logos/koolhaas-logo-tight.png" alt="Koolhaas Installaties" className="brand-logo doc-foot-brand-logo" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- vaste documentlayout, zelfde als de offerte
                  <img src="/logos/websup-icon.png" alt="WebsUp" className="doc-foot-icon" />
                )}
                <div className="doc-foot-meta">
                  <div className="doc-foot-meta-row">
                    {!isKoolhaas && <span>{brand.website}</span>}
                    <span>{brand.email}</span>
                    <span>{brand.phone}</span>
                  </div>
                  <div className="doc-foot-meta-row">
                    <span>KVK {s.kvk || missing}</span>
                    <span>Btw-id {s.vatNumber || missing}</span>
                    <span>IBAN {s.iban || missing}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
