"use client";

/* eslint-disable @next/next/no-img-element -- Chromium rendert dit naar PDF; next/image voegt daar niets toe */
import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  flattenRows,
  groupInvoiceLines,
  lineAmount,
  paginateInvoice,
  shouldUseOverview,
  vatBreakdown,
  type LayoutLine,
  type SpecRow,
} from "@/lib/invoice-layout";
import { formatIban, type InvoiceBrand, type InvoiceSettings } from "@/lib/invoice-company";

export type InvoiceVariant = "concept" | "open" | "herinnering" | "betaald";

export type InvoiceDocData = {
  number: string;
  subject: string | null;
  variant: InvoiceVariant;
  brand: InvoiceBrand;
  company: InvoiceSettings;
  customer: { name: string; address: string | null; zipCode: string | null; city: string | null; vatNumber: string | null };
  meta: [string, string][];
  intro: string | null;
  closing: string | null;
  termDays: number;
  dueDateLabel: string | null;
  paidAtLabel: string | null;
  lines: LayoutLine[];
};

const eur = (n: number) =>
  "€ " + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
const unitLabel = (unit?: string | null) => {
  const u = (unit ?? "").trim();
  return u === "stuk" || u === "stuks" ? "st" : u;
};
const pct = (n: number) => `${num(n)}%`;

/** Marge onder de laatste rij, zodat afrondingsverschillen nooit een regel afsnijden. */
const SAFETY = 12;

type Measured = { pages: SpecRow[][] };

export function InvoiceDocument({ data, fontClassName }: { data: InvoiceDocData; fontClassName: string }) {
  const groups = useMemo(() => groupInvoiceLines(data.lines), [data.lines]);
  const rows = useMemo(() => flattenRows(groups), [groups]);
  const overview = shouldUseOverview(groups);
  const vat = useMemo(() => vatBreakdown(data.lines), [data.lines]);
  const subtotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const total = Math.round((subtotal + vat.reduce((s, v) => s + v.vat, 0)) * 100) / 100;

  const [measured, setMeasured] = useState<Measured | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    // Eerst de fonts, anders meten we met een terugvalfont en kloppen de hoogtes niet.
    document.fonts.ready.then(() => {
      const root = measureRef.current;
      if (cancelled || !root) return;
      const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;
      const bottomOf = (page: HTMLElement) => page.querySelector<HTMLElement>(".inv-content")!.getBoundingClientRect().bottom;
      const contNote = q(".inv-cont").getBoundingClientRect().height;

      const first = q("[data-measure='first']");
      // Met overzicht staat er op pagina 1 geen specificatie: capaciteit 0.
      const firstCapacity = overview
        ? 0
        : bottomOf(first) - first.querySelector("thead")!.getBoundingClientRect().bottom - SAFETY;

      const next = q("[data-measure='next']");
      const nextCapacity = bottomOf(next) - next.querySelector("thead")!.getBoundingClientRect().bottom - SAFETY;
      const heights = [...next.querySelectorAll<HTMLElement>("tbody tr[data-row]")].map((tr) => tr.getBoundingClientRect().height);
      const contHeight = q("[data-cont-row]").getBoundingClientRect().height;
      const tailHeight = q("[data-measure='tail']").getBoundingClientRect().height;

      const pages = paginateInvoice({
        rows,
        heights,
        contHeight,
        firstCapacity: Math.max(0, firstCapacity),
        nextCapacity,
        tailHeight,
        continueNoteHeight: contNote,
        labeled: groups.map((g) => !!g.label),
      });
      setMeasured({ pages });
    });
    return () => {
      cancelled = true;
    };
  }, [rows, groups, overview]);

  useLayoutEffect(() => {
    // Seintje voor de PDF-renderer dat de pagina's klaar zijn.
    if (measured) document.documentElement.dataset.invoiceReady = "1";
  }, [measured]);

  const renderRow = (row: SpecRow, key: string | number, attrs?: Record<string, string>) => {
    const g = groups[row.group];
    if (row.kind === "group") {
      return (
        <tr key={key} className="inv-group" {...attrs}>
          <td colSpan={5}>
            {g.label}
            {row.cont ? (
              <span className="inv-cg">vervolg</span>
            ) : g.hours != null && g.lines.length > 1 ? (
              <span className="inv-period">{num(g.hours)} uur</span>
            ) : null}
          </td>
        </tr>
      );
    }
    const l = g.lines[row.line];
    return (
      <tr key={key} {...attrs}>
        <td>
          <div className="inv-desc">{l.description}</div>
          {l.detail ? <div className="inv-sub">{l.detail}</div> : null}
        </td>
        <td className="n">{`${num(l.qty)} ${unitLabel(l.unit)}`.trim()}</td>
        <td className="n">{eur(l.unitPrice)}</td>
        <td className="n">{pct(l.vatRate)}</td>
        <td className="n">{eur(lineAmount(l))}</td>
      </tr>
    );
  };

  const table = (body: ReactNode) => (
    <table className="inv-fx">
      <colgroup>
        <col />
        <col style={{ width: 92 }} />
        <col style={{ width: 104 }} />
        <col style={{ width: 60 }} />
        <col style={{ width: 116 }} />
      </colgroup>
      <thead>
        <tr>
          <th>Omschrijving</th>
          <th className="n">Aantal</th>
          <th className="n">Prijs</th>
          <th className="n">Btw</th>
          <th className="n">Bedrag</th>
        </tr>
      </thead>
      <tbody>{body}</tbody>
    </table>
  );

  const totals = (
    <div className="inv-totals">
      <dl>
        <dt>Subtotaal excl. btw</dt>
        <dd>{eur(subtotal)}</dd>
        {vat.map((v) => (
          <Fragment key={v.rate}>
            <dt>{vat.length > 1 ? `Btw ${pct(v.rate)} over ${eur(v.base)}` : `Btw ${pct(v.rate)}`}</dt>
            <dd>{eur(v.vat)}</dd>
          </Fragment>
        ))}
        <dt className="inv-grand">Totaal</dt>
        <dd className="inv-grand">{eur(total)}</dd>
      </dl>
    </div>
  );

  const tail = (
    <div>
      {totals}
      {data.closing ? <p className="inv-closing">{data.closing}</p> : null}
    </div>
  );

  const pageCount = measured ? measured.pages.length : 1;

  return (
    <div className={`invdoc t-${data.brand.key} s-${data.variant} ${fontClassName}`}>
      <InvoiceStyles brand={data.brand} />
      {measured ? (
        <div className="inv-pages">
          {measured.pages.map((pageRows, pi) => {
            const isLast = pi === measured.pages.length - 1;
            return (
              <Page key={pi} data={data} index={pi} count={pageCount}>
                {pi === 0 ? (
                  <FirstPageHead data={data} total={total} heading={overview ? "Overzicht" : "Specificatie"}>
                    {overview ? (
                      <Overview groups={groups} totals={totals} informal={data.brand.informal} />
                    ) : (
                      table(pageRows.map((r, i) => renderRow(r, i)))
                    )}
                  </FirstPageHead>
                ) : (
                  <>
                    <MiniHead data={data} label={pi === 1 && overview ? "Specificatie" : "Specificatie, vervolg"} />
                    {table(pageRows.map((r, i) => renderRow(r, i)))}
                  </>
                )}
                {isLast ? tail : <div className="inv-cont">Vervolg op de volgende pagina</div>}
              </Page>
            );
          })}
        </div>
      ) : null}

      {/* Meetlaag: onzichtbaar, zelfde breedtes als de echte pagina's. */}
      {!measured ? (
        <div ref={measureRef} className="inv-measure" aria-hidden>
          <Page data={data} index={0} count={1} measure="first">
            <FirstPageHead data={data} total={total} heading={overview ? "Overzicht" : "Specificatie"}>
              {overview ? <Overview groups={groups} totals={totals} informal={data.brand.informal} /> : table(null)}
            </FirstPageHead>
          </Page>
          <Page data={data} index={1} count={2} measure="next">
            <MiniHead data={data} label="Specificatie, vervolg" />
            {table(
              <>
                {rows.map((r, i) => renderRow(r, i, { "data-row": String(i) }))}
                {renderRow({ kind: "group", group: 0, cont: true }, "cont", { "data-cont-row": "1" })}
              </>,
            )}
            <div data-measure="tail">{tail}</div>
            <div className="inv-cont">Vervolg op de volgende pagina</div>
          </Page>
        </div>
      ) : null}
    </div>
  );
}

function Page({
  data,
  index,
  count,
  measure,
  children,
}: {
  data: InvoiceDocData;
  index: number;
  count: number;
  measure?: "first" | "next";
  children: ReactNode;
}) {
  const c = data.company;
  const missing = (value: string, label: string) => value || <span className="inv-ph">{label} ontbreekt</span>;
  return (
    <article className="inv-page" data-measure={measure}>
      <div className="inv-strip" />
      <div className="inv-inner">
        <div className="inv-content">{children}</div>
      </div>
      <footer className="inv-foot">
        <div>
          <strong>{data.brand.tradeName}</strong>
          {c.ownerName}
          <br />
          {missing(c.address, "Adres")}
          <br />
          {c.zipCode || c.city ? `${c.zipCode} ${c.city}`.trim() : missing("", "Postcode en plaats")}
        </div>
        <div>
          <strong>Registratie</strong>
          KvK {missing(c.kvk, "KvK")}
          <br />
          Btw {missing(c.vatNumber, "Btw-id")}
          <br />
          Algemene voorwaarden van toepassing
        </div>
        <div>
          <strong>Contact</strong>
          {data.brand.email}
          <br />
          {data.brand.phone}
          <br />
          {data.brand.website}
        </div>
        <div className="inv-pn">
          <span>Factuur {data.number}</span>
          <span>{count > 1 ? `Pagina ${index + 1} van ${count}` : ""}</span>
        </div>
      </footer>
    </article>
  );
}

function FirstPageHead({
  data,
  total,
  heading,
  children,
}: {
  data: InvoiceDocData;
  total: number;
  heading: string;
  children: ReactNode;
}) {
  const { brand, company, customer, variant } = data;
  const informal = brand.informal;
  const reminderLine =
    variant === "herinnering"
      ? informal
        ? "Heb je al betaald? Dan kun je dit bericht negeren."
        : "Heeft u al betaald? Dan kunt u dit bericht negeren."
      : null;
  const stamp = { concept: "Concept", herinnering: "Herinnering", betaald: "Betaald", open: null }[variant];

  return (
    <>
      <header className="inv-top">
        <div className="inv-logo">
          <img src={brand.logo} alt={brand.tradeName} style={{ height: brand.logoHeight }} />
        </div>
        <div className="inv-docid">
          <div className="inv-eyebrow">{variant === "herinnering" ? "Betalingsherinnering" : "Factuur"}</div>
          <div className="inv-docnum">{data.number}</div>
          {data.subject ? <div className="inv-kind">{data.subject}</div> : null}
        </div>
      </header>
      {stamp ? <div className="inv-stamp">{stamp}</div> : null}

      <section className="inv-parties">
        <div>
          <div className="inv-label">Aan</div>
          <div className="inv-addr">
            <strong>{customer.name}</strong>
            {customer.address ? <div>{customer.address}</div> : null}
            {customer.zipCode || customer.city ? <div>{[customer.zipCode, customer.city].filter(Boolean).join(" ")}</div> : null}
            {customer.vatNumber ? <div className="inv-muted">Btw-id {customer.vatNumber}</div> : null}
          </div>
        </div>
        <dl className="inv-meta">
          {data.meta.map(([k, v]) => (
            <Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </Fragment>
          ))}
        </dl>
      </section>

      {data.intro || reminderLine ? (
        <p className="inv-note">
          {[reminderLine, data.intro].filter(Boolean).join("\n")}
        </p>
      ) : null}

      <section className="inv-pay">
        <div>
          <div className="inv-amt-l">
            {variant === "betaald" ? "Betaald" : variant === "herinnering" ? "Nog te betalen" : "Te betalen"}
          </div>
          <div className="inv-amt">{eur(total)}</div>
          {variant === "betaald" && data.paidAtLabel ? (
            <div className="inv-due">
              <i className="inv-dot" /> Ontvangen op {data.paidAtLabel}
            </div>
          ) : null}
          {variant === "herinnering" && data.dueDateLabel ? (
            <div className="inv-due">
              <i className="inv-dot" /> Betaaldatum was {data.dueDateLabel}
            </div>
          ) : null}
        </div>
        {variant !== "betaald" ? (
          <div className="inv-how">
            <div>
              <span>IBAN</span>
              <span>{company.iban ? formatIban(company.iban) : <span className="inv-ph">IBAN ontbreekt</span>}</span>
            </div>
            <div>
              <span>T.n.v.</span>
              <span>{company.accountName || brand.tradeName}</span>
            </div>
            <div>
              <span>Omschrijving</span>
              <span>{data.number}</span>
            </div>
            <div>
              <span>Termijn</span>
              <span>{data.termDays} dagen</span>
            </div>
          </div>
        ) : (
          <div className="inv-how">
            <div>
              <span>Factuur</span>
              <span>{data.number}</span>
            </div>
            <div>
              <span>Status</span>
              <span>Voldaan, {informal ? "dank je wel" : "hartelijk dank"}</span>
            </div>
          </div>
        )}
      </section>

      <section className="inv-spec">
        <h2>{heading}</h2>
        {children}
      </section>
    </>
  );
}

function Overview({
  groups,
  totals,
  informal,
}: {
  groups: ReturnType<typeof groupInvoiceLines>;
  totals: ReactNode;
  informal: boolean;
}) {
  return (
    <>
      <table className="inv-fx inv-ov">
        <colgroup>
          <col />
          <col style={{ width: 160 }} />
          <col style={{ width: 116 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Onderdeel</th>
            <th className="n">Omvang</th>
            <th className="n">Bedrag</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={i}>
              <td className="inv-desc">{g.label ?? "Overig"}</td>
              <td className="n inv-normal">
                {g.hours != null ? `${num(g.hours)} uur` : `${g.lines.length} ${g.lines.length === 1 ? "regel" : "regels"}`}
              </td>
              <td className="n">{eur(g.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totals}
      <p className="inv-ov-note">
        {informal
          ? "De volledige specificatie per regel staat op de volgende pagina's."
          : "De volledige specificatie per regel vindt u op de volgende pagina's."}
      </p>
    </>
  );
}

function MiniHead({ data, label }: { data: InvoiceDocData; label: string }) {
  return (
    <div className="inv-mini">
      <img src={data.brand.logo} alt={data.brand.tradeName} style={{ height: data.brand.miniLogoHeight }} />
      <div className="inv-r">
        <strong>{data.number}</strong>
        {label}
      </div>
    </div>
  );
}

function InvoiceStyles({ brand }: { brand: InvoiceBrand }) {
  const c = brand.colors;
  const heading = brand.headingFont === "sora" ? "var(--inv-sora)" : "var(--inv-bricolage)";
  const body = brand.headingFont === "sora" ? "var(--inv-sora)" : "var(--inv-nunito)";
  return (
    <style>{`
      @page { size: A4; margin: 0; }
      html, body { margin: 0; background: #e9e7ee; }
      .invdoc {
        --ink: #0f172a; --muted: #5b6475; --line: #e5e7eb;
        --h-font: ${heading}, system-ui, sans-serif;
        --strip: ${c.strip}; --accent-text: ${c.accentText};
        --pay-bg: ${c.payBg}; --pay-fg: #fff; --pay-div: rgba(255,255,255,.18); --dot: ${c.dot};
        --stamp: #64748b;
        font-family: ${body}, system-ui, sans-serif; color: var(--ink);
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      .invdoc.s-betaald { --pay-bg: #ecfdf3; --pay-fg: #064e3b; --pay-div: #a7f3d0; --dot: #059669; --stamp: #059669; }
      .invdoc.s-herinnering { --stamp: #b42318; --dot: #f04438; }
      .invdoc *, .invdoc *::before, .invdoc *::after { box-sizing: border-box; }

      .inv-pages { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 32px 0 64px; }
      .inv-measure { position: absolute; left: -10000px; top: 0; visibility: hidden; }
      .inv-page { width: 210mm; height: 296.8mm; background: #fff; position: relative; display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 12px 32px rgba(0,0,0,.08); }
      .inv-strip { height: 6px; background: var(--strip); flex: none; }
      .inv-inner { padding: 32px 56px 0; flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .inv-content { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }

      .inv-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
      .inv-logo img { display: block; width: auto; }
      .inv-docid { text-align: right; }
      .inv-eyebrow { font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent-text); }
      .inv-docnum { font-family: var(--h-font); font-weight: 700; font-size: 28px; line-height: 1.1; margin-top: 4px; letter-spacing: -.01em; }
      .t-koolhaas .inv-docnum { font-weight: 600; }
      .inv-kind { font-size: 14px; color: var(--muted); margin-top: 4px; max-width: 360px; }

      /* In de lege ruimte tussen logo en factuurnummer, zodat het nooit over gegevens valt. */
      .inv-stamp { position: absolute; top: 56px; left: 50%; transform: translateX(-50%) rotate(-8deg); border: 3px solid var(--stamp); color: var(--stamp);
        font-family: var(--h-font); font-weight: 800; font-size: 22px; letter-spacing: .06em; text-transform: uppercase; padding: 6px 14px; border-radius: 8px; opacity: .9; }

      .inv-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 28px; }
      .inv-label { font-size: 13px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
      .inv-addr { font-size: 16px; line-height: 1.4; }
      .inv-addr strong { font-weight: 700; display: block; }
      .inv-muted { color: var(--muted); font-size: 14px; }
      .inv-meta { display: grid; grid-template-columns: auto 1fr; column-gap: 16px; row-gap: 4px; font-size: 15px; align-content: start; margin: 0; }
      .inv-meta dt { color: var(--muted); }
      .inv-meta dd { margin: 0; font-weight: 600; text-align: right; }

      .inv-note { margin: 20px 0 0; font-size: 16px; line-height: 1.45; max-width: 60ch; white-space: pre-line; }

      .inv-pay { margin-top: 20px; border-radius: 16px; background: var(--pay-bg); color: var(--pay-fg); display: grid;
        grid-template-columns: auto minmax(0,1fr); gap: 24px; padding: 18px 24px; align-items: center; flex: none; }
      .inv-amt-l { font-size: 14px; opacity: .75; }
      .inv-amt { font-family: var(--h-font); font-weight: 800; font-size: 36px; line-height: 1.05; letter-spacing: -.02em; margin-top: 4px; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .inv-due { white-space: nowrap; font-size: 15px; margin-top: 8px; display: inline-flex; align-items: center; gap: 8px; }
      .inv-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dot); display: inline-block; }
      .inv-how { font-size: 14px; line-height: 1.5; border-left: 1px solid var(--pay-div); padding-left: 24px; }
      .inv-how > div { display: flex; justify-content: space-between; gap: 12px; }
      .inv-how > div > span:first-child { opacity: .7; }
      .inv-how > div > span:last-child { white-space: nowrap; font-weight: 700; font-variant-numeric: tabular-nums; }

      .inv-spec { margin-top: 24px; }
      .inv-spec h2 { font-family: var(--h-font); font-size: 18px; font-weight: 700; margin: 0 0 8px; letter-spacing: -.01em; }
      .invdoc table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
      .invdoc .inv-fx { table-layout: fixed; }
      .invdoc thead th { font-size: 13px; font-weight: 600; color: var(--muted); text-align: left; padding: 0 0 8px; border-bottom: 1px solid var(--ink); }
      .invdoc th.n, .invdoc td.n { text-align: right; white-space: nowrap; padding-left: 16px; }
      .invdoc tbody td { padding: 8px 0; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 15px; }
      .inv-desc { font-size: 16px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
      .inv-sub { font-size: 14px; color: var(--muted); margin-top: 1px; font-weight: 400; line-height: 1.3; white-space: pre-line; }
      .invdoc tr.inv-group td { padding: 12px 0 2px; border-bottom: 0; font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--accent-text); }
      .inv-period, .inv-cg { display: inline-block; font-size: 13px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--muted); margin-left: 8px; }
      .inv-ov td { padding: 10px 0; }
      .inv-ov td.n { font-weight: 700; }
      .inv-ov td.inv-normal { font-weight: 400; }
      .inv-ov-note { font-size: 14px; color: var(--muted); margin: 10px 0 0; }

      .inv-totals { display: flex; justify-content: flex-end; margin-top: 12px; }
      .inv-totals dl { width: 340px; margin: 0; display: grid; grid-template-columns: 1fr auto; row-gap: 6px; column-gap: 0; font-size: 15px; font-variant-numeric: tabular-nums; }
      .inv-totals dt { color: var(--muted); }
      .inv-totals dd { margin: 0; text-align: right; padding-left: 16px; }
      .inv-totals .inv-grand { border-top: 1px solid var(--ink); padding-top: 8px; margin-top: 4px; font-family: var(--h-font); font-weight: 700; font-size: 20px; color: var(--ink); }
      .inv-closing { margin: 20px 0 0; font-size: 16px; line-height: 1.45; max-width: 60ch; white-space: pre-line; }

      .inv-mini { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; margin-bottom: 20px; border-bottom: 1px solid var(--line); }
      .inv-mini img { display: block; width: auto; }
      .inv-r { text-align: right; font-size: 14px; color: var(--muted); }
      .inv-r strong { display: block; font-family: var(--h-font); font-size: 18px; color: var(--ink); }
      .inv-cont { margin-top: auto; padding-top: 12px; font-size: 13px; color: var(--muted); text-align: right; }

      .inv-foot { flex: none; padding: 14px 56px 20px; border-top: 1px solid var(--line); display: grid; grid-template-columns: 1.1fr 1fr 1fr; column-gap: 24px;
        font-size: 13px; line-height: 1.45; color: var(--muted); }
      .inv-foot strong { color: var(--ink); font-weight: 700; display: block; margin-bottom: 2px; }
      .inv-pn { grid-column: 1 / -1; display: flex; justify-content: space-between; border-top: 1px solid var(--line); padding-top: 8px; margin-top: 8px; }
      .inv-ph { background: #fff7d6; color: #6b5400; border-radius: 4px; padding: 0 4px; }

      /* Op een telefoon verkleinen, zodat de A4 in beeld past zonder zijwaarts scrollen. */
      @media screen and (max-width: 820px) { .inv-pages { zoom: .9; padding: 12px 0 32px; } }
      @media screen and (max-width: 720px) { .inv-pages { zoom: .75; } }
      @media screen and (max-width: 600px) { .inv-pages { zoom: .6; } }
      @media screen and (max-width: 480px) { .inv-pages { zoom: .45; } }
      @media print {
        html, body { background: #fff; }
        .inv-pages { display: block; padding: 0; gap: 0; zoom: 1; }
        .inv-page { box-shadow: none; break-after: page; }
        .inv-page:last-child { break-after: auto; }
      }
    `}</style>
  );
}
