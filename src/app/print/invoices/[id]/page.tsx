import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintOnLoad } from "@/components/print-on-load";
import { getInvoiceSettings } from "@/lib/branding";
import { formatCurrency, formatDate } from "@/lib/format";

/** Huisstijl per bedrijf. Kleuren gelijk aan de offerte-PDF (src/lib/pdf/quote-template.tsx). */
const BRAND = {
  websup: {
    name: "WebsUp.nl",
    logo: "/logos/websup-color.png",
    website: "websup.nl",
    email: "info@websup.nl",
    phone: "06 82 20 21 48",
    ink: "#06040c",
    accent: "#f04f8f",
    soft: "#fdf0f5",
    display: "'Bricolage Grotesque', sans-serif",
    font: "family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800",
  },
  koolhaas: {
    name: "Koolhaas Installaties",
    logo: "/logos/koolhaas-logo-tight.png",
    website: "koolhaasinstallaties.nl",
    email: "info@koolhaasinstallaties.nl",
    phone: "06 82 20 21 48",
    ink: "#0c1f3d",
    accent: "#1f9ba3",
    soft: "#eef7f7",
    display: "'Sora', sans-serif",
    font: "family=Sora:wght@500;700;800",
  },
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

  const brand = invoice.company.slug === "koolhaas" ? BRAND.koolhaas : BRAND.websup;
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

  return (
    <main>
      <PrintOnLoad enabled={auto === "1"} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?${brand.font}&family=Figtree:wght@400;500;600;700&display=swap`}
      />
      <style>{`
        @page { size: A4; margin: 0; }
        html, body { background: #e9ebef; }
        .inv { --ink: ${brand.ink}; --accent: ${brand.accent}; --soft: ${brand.soft}; --muted: #667085; --line: #e6e8ec;
          font-family: 'Figtree', system-ui, sans-serif; color: var(--ink); font-size: 10pt; line-height: 1.45;
          width: 210mm; min-height: 297mm; margin: 24px auto; background: #fff; position: relative;
          box-shadow: 0 20px 60px -20px rgba(15,23,42,.25); display: flex; flex-direction: column; }
        .inv * { box-sizing: border-box; }
        .inv .band { height: 6mm; background: linear-gradient(90deg, var(--ink) 0 72%, var(--accent) 72% 100%); }
        .inv .page { padding: 14mm 16mm 0; flex: 1; display: flex; flex-direction: column; }
        .inv .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; }
        .inv .logo { height: 13mm; width: auto; object-fit: contain; }
        .inv .title { text-align: right; }
        .inv .title h1 { font-family: ${brand.display}; font-weight: 800; font-size: 34pt; letter-spacing: -0.03em; line-height: .9; margin: 0; }
        .inv .title .no { margin-top: 2.5mm; font-weight: 600; color: var(--accent); letter-spacing: .02em; }
        .inv .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin-top: 11mm; border-top: 1.5px solid var(--ink); border-bottom: 1px solid var(--line); }
        .inv .meta div { padding: 3mm 0; }
        .inv .meta div + div { padding-left: 4mm; border-left: 1px solid var(--line); }
        .inv .lbl { font-size: 7pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 1mm; }
        .inv .meta .v { font-weight: 600; }
        .inv .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; margin-top: 9mm; }
        .inv .parties .name { font-family: ${brand.display}; font-weight: 700; font-size: 12.5pt; margin-bottom: 1mm; }
        .inv .parties p { margin: 0; color: #344054; white-space: pre-line; }
        .inv table { width: 100%; border-collapse: collapse; margin-top: 10mm; }
        .inv thead th { font-size: 7pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--muted);
          text-align: left; padding: 0 2mm 2.5mm; border-bottom: 1.5px solid var(--ink); }
        .inv th:first-child, .inv td:first-child { padding-left: 0; }
        .inv th:last-child, .inv td:last-child { padding-right: 0; }
        .inv tbody td { padding: 3mm 2mm; border-bottom: 1px solid var(--line); vertical-align: top; }
        .inv tbody tr { break-inside: avoid; }
        .inv .desc { white-space: pre-line; }
        .inv .desc::first-line { font-weight: 600; }
        .inv .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .inv .sub { color: var(--muted); }
        .inv .bottom { display: grid; grid-template-columns: 1fr 78mm; gap: 10mm; margin-top: 7mm; align-items: start; break-inside: avoid; }
        .inv .totals div { display: flex; justify-content: space-between; padding: 1.2mm 0; font-variant-numeric: tabular-nums; }
        .inv .totals .muted { color: var(--muted); }
        .inv .due { margin-top: 3mm; background: var(--ink); color: #fff; padding: 5mm 5mm 4.5mm; position: relative; overflow: hidden; }
        .inv .due::after { content: ""; position: absolute; right: 0; top: 0; bottom: 0; width: 2.2mm; background: var(--accent); }
        .inv .due .lbl { color: rgba(255,255,255,.6); margin: 0; }
        .inv .due .amt { font-family: ${brand.display}; font-weight: 800; font-size: 22pt; letter-spacing: -0.02em; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .inv .pay { background: var(--soft); padding: 5mm; }
        .inv .pay p { margin: 0 0 1.5mm; color: #344054; }
        .inv .pay .row { display: grid; grid-template-columns: 26mm 1fr; gap: 1mm 3mm; margin-top: 2.5mm; }
        .inv .pay .row span:nth-child(odd) { color: var(--muted); }
        .inv .pay .row span:nth-child(even) { font-weight: 600; }
        .inv .notes { margin-top: 8mm; white-space: pre-line; color: #344054; }
        .inv .stamp { position: absolute; top: 58mm; right: 18mm; transform: rotate(-8deg); border: 2.5px solid #12b76a; color: #12b76a;
          font-family: ${brand.display}; font-weight: 800; font-size: 20pt; letter-spacing: .12em; padding: 1mm 5mm; border-radius: 2mm; opacity: .85; }
        .inv footer { margin-top: auto; padding: 8mm 0 9mm; }
        .inv footer .custom { color: var(--muted); font-size: 8.5pt; margin-bottom: 3mm; white-space: pre-line; }
        .inv footer .line { display: flex; flex-wrap: wrap; gap: 1.5mm 5mm; border-top: 1px solid var(--line); padding-top: 3mm; font-size: 8pt; color: var(--muted); }
        .inv footer .line b { color: var(--ink); font-weight: 600; }
        .inv .warn { color: #b42318; font-weight: 600; }
        .toolbar { width: 210mm; margin: 16px auto 0; display: flex; justify-content: flex-end; gap: 8px; font-family: 'Figtree', system-ui, sans-serif; }
        .toolbar button, .toolbar a { background: ${brand.ink}; color: #fff; border: 0; border-radius: 8px; padding: 9px 14px; font-weight: 600; font-size: 14px; cursor: pointer; text-decoration: none; }
        .toolbar a { background: #fff; color: ${brand.ink}; box-shadow: inset 0 0 0 1px #d0d5dd; }
        @media screen and (max-width: 820px) { .inv, .toolbar { width: auto; margin: 12px; } .inv { min-height: 0; } }
        @media print {
          html, body { background: #fff; }
          .toolbar { display: none; }
          .inv { margin: 0; box-shadow: none; width: 210mm; min-height: 297mm; }
          .inv * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="toolbar">
        <a href={`/invoices/${invoice.id}`}>Terug naar bewerken</a>
        <button type="button" data-print>Opslaan als PDF</button>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.querySelector('[data-print]')?.addEventListener('click',()=>window.print());document.title=${JSON.stringify(`Factuur ${invoice.number} - ${c?.name ?? ""}`)};`,
        }}
      />

      <div className="inv">
        <div className="band" />
        {paid && <div className="stamp">BETAALD</div>}
        <div className="page">
          <div className="top">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src={brand.logo} alt={brand.name} />
            <div className="title">
              <h1>Factuur</h1>
              <div className="no">{invoice.number}</div>
            </div>
          </div>

          <div className="meta">
            <div>
              <div className="lbl">Factuurdatum</div>
              <div className="v">{formatDate(invoice.invoiceDate)}</div>
            </div>
            <div>
              <div className="lbl">Vervaldatum</div>
              <div className="v">{invoice.dueDate ? formatDate(invoice.dueDate) : "—"}</div>
            </div>
            <div>
              <div className="lbl">Betaaltermijn</div>
              <div className="v">{s.paymentDays} dagen</div>
            </div>
            <div>
              <div className="lbl">{invoice.project ? "Project" : "Referentie"}</div>
              <div className="v">{invoice.project ? invoice.project.number : invoice.reference || "—"}</div>
            </div>
          </div>

          <div className="parties">
            <div>
              <div className="lbl">Factuur aan</div>
              <div className="name">{c?.name ?? "—"}</div>
              <p>
                {[c?.address, [c?.zipCode, c?.city].filter(Boolean).join(" ")].filter(Boolean).join("\n")}
                {c?.kvk ? `\nKvK ${c.kvk}` : ""}
                {c?.vatNumber ? `\nBtw-id ${c.vatNumber}` : ""}
              </p>
            </div>
            <div>
              <div className="lbl">Van</div>
              <div className="name">{invoice.company.name}</div>
              <p>
                {s.address || <span className="warn">Bedrijfsadres ontbreekt</span>}
                {"\n"}{brand.email} · {brand.phone}
              </p>
            </div>
          </div>

          {invoice.project && invoice.reference && (
            <p style={{ margin: "7mm 0 0", color: "#344054" }}>
              <span className="lbl" style={{ display: "inline", marginRight: "2mm" }}>Betreft</span>
              {invoice.reference}
            </p>
          )}

          <table>
            <thead>
              <tr>
                <th>Omschrijving</th>
                <th className="num">Aantal</th>
                <th className="num">Prijs</th>
                <th className="num">Btw</th>
                <th className="num">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l) => (
                <tr key={l.id}>
                  <td className="desc">{l.description}</td>
                  <td className="num">{qty(Number(l.qty))} <span className="sub">{l.unit ?? ""}</span></td>
                  <td className="num">{formatCurrency(Number(l.unitPrice))}</td>
                  <td className="num sub">{Number(l.vatRate)}%</td>
                  <td className="num">{formatCurrency(Number(l.qty) * Number(l.unitPrice))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bottom">
            <div className="pay">
              <div className="lbl">Betalen</div>
              {paid ? (
                <p>Deze factuur is betaald. Bedankt!</p>
              ) : (
                <p>
                  Maak het bedrag {invoice.dueDate ? <>vóór <b>{formatDate(invoice.dueDate)}</b></> : "binnen " + s.paymentDays + " dagen"} over
                  onder vermelding van het factuurnummer.
                </p>
              )}
              <div className="row">
                <span>IBAN</span>
                <span>{s.iban || <span className="warn">ontbreekt</span>}</span>
                <span>T.n.v.</span>
                <span>{s.accountHolder || invoice.company.name}</span>
                <span>Kenmerk</span>
                <span>{invoice.number}</span>
              </div>
            </div>
            <div>
              <div className="totals">
                <div>
                  <span className="muted">Subtotaal</span>
                  <span>{formatCurrency(Number(invoice.totalExVat))}</span>
                </div>
                {[...vatGroups.entries()].sort((a, b) => b[0] - a[0]).map(([rate, g]) => (
                  <div key={rate}>
                    <span className="muted">Btw {rate}% over {formatCurrency(g.base)}</span>
                    <span>{formatCurrency(g.vat)}</span>
                  </div>
                ))}
              </div>
              <div className="due">
                <p className="lbl">{paid ? "Totaal betaald" : "Te betalen"}</p>
                <div className="amt">{formatCurrency(Number(invoice.totalIncVat))}</div>
              </div>
            </div>
          </div>

          {invoice.notes && <div className="notes">{invoice.notes}</div>}

          <footer>
            {s.footer && <div className="custom">{s.footer}</div>}
            <div className="line">
              <span><b>{invoice.company.name}</b></span>
              <span>{brand.website}</span>
              <span>KvK {s.kvk || <span className="warn">ontbreekt</span>}</span>
              <span>Btw-id {s.vatNumber || <span className="warn">ontbreekt</span>}</span>
              <span>IBAN {s.iban || <span className="warn">ontbreekt</span>}</span>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
