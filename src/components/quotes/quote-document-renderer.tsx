import { Check, ExternalLink, Info, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { parseQuoteDocument, type QuoteDocument, type QuoteDocumentBlock } from "@/lib/quote-document";

type RenderItem = {
  id?: string;
  description: string;
  qty: number | string;
  unitPrice: number | string;
  vatRate?: number | string;
  indent?: number;
  hiddenOnQuote?: boolean;
};

type RenderChoiceGroup = {
  id?: string;
  title: string;
  choices: Array<{
    id?: string;
    label?: string;
    title: string;
    summary?: string;
    items: RenderItem[];
  }>;
};

export type QuoteDocumentRenderData = {
  number: string;
  title?: string | null;
  customer: { name: string };
  items: RenderItem[];
  choiceGroups?: RenderChoiceGroup[] | null;
  totalIncVat?: number | string;
  company?: { name?: string | null; slug?: string | null };
};

export function QuoteDocumentRenderer({
  document,
  quote,
  className = "",
}: {
  document: QuoteDocument | unknown;
  quote: QuoteDocumentRenderData;
  className?: string;
}) {
  const parsed = parseQuoteDocument(document);
  if (!parsed) return null;
  const pages = splitPages(parsed.blocks);
  const isKoolhaas = quote.company?.slug === "koolhaas";

  return (
    <div className={`quote-document space-y-5 ${className}`}>
      {pages.map((blocks, pageIndex) => (
        <article
          key={pageIndex}
          className="quote-document-page relative mx-auto min-h-[720px] w-full max-w-[820px] overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] print:min-h-0 print:max-w-none print:rounded-none print:border-0 print:shadow-none"
          style={{ breakBefore: pageIndex > 0 ? "page" : "auto" }}
        >
          <div className={`h-1.5 w-full ${isKoolhaas ? "bg-[#147f88]" : "bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500"}`} />
          <div className="flex min-h-[718px] flex-col px-7 py-7 sm:px-12 sm:py-10 print:min-h-0">
            <header className="mb-10 flex items-center justify-between border-b border-slate-100 pb-5 text-xs text-slate-400">
              <span className="font-semibold text-slate-700">{quote.company?.name || (isKoolhaas ? "Koolhaas Installaties" : "WebsUp.nl")}</span>
              <span>{quote.number} · {quote.customer.name}</span>
            </header>
            <div className="flex-1 space-y-9">
              {blocks.map((block) => <QuoteDocumentBlockView key={block.id} block={block} quote={quote} isKoolhaas={isKoolhaas} />)}
            </div>
            <footer className="mt-12 flex items-center justify-between border-t border-slate-100 pt-4 text-[11px] text-slate-400">
              <span>{quote.customer.name}</span>
              <span>{String(pageIndex + 1).padStart(2, "0")} / {String(pages.length).padStart(2, "0")}</span>
            </footer>
          </div>
        </article>
      ))}
    </div>
  );
}

function splitPages(blocks: QuoteDocumentBlock[]) {
  const pages: QuoteDocumentBlock[][] = [[]];
  for (const block of blocks) {
    if (block.type === "pageBreak") {
      if (pages.at(-1)?.length) pages.push([]);
      continue;
    }
    pages.at(-1)?.push(block);
  }
  return pages.filter((page) => page.length > 0);
}

export function QuoteDocumentBlockView({ block, quote, isKoolhaas }: { block: QuoteDocumentBlock; quote: QuoteDocumentRenderData; isKoolhaas: boolean }) {
  const accent = isKoolhaas ? "text-[#147f88]" : "text-orange-600";
  if (block.type === "hero") {
    return (
      <section className="py-3">
        <p className={`mb-3 text-xs font-black uppercase tracking-[0.18em] ${accent}`}>{block.eyebrow}</p>
        <h1 className="max-w-3xl break-words text-4xl font-black leading-[1.05] tracking-[-0.035em] text-slate-950 [overflow-wrap:anywhere] sm:text-5xl">{block.title}</h1>
        {block.text && <p className="mt-6 max-w-2xl whitespace-pre-wrap text-[15px] leading-7 text-slate-600">{block.text}</p>}
      </section>
    );
  }
  if (block.type === "text") {
    const tone = block.tone === "accent"
      ? isKoolhaas ? "border-[#147f88]/25 bg-[#147f88]/5" : "border-orange-200 bg-orange-50/70"
      : block.tone === "note" ? "border-slate-200 bg-slate-50" : "border-transparent";
    return (
      <section className={`rounded-2xl border p-0 ${block.tone === "plain" ? "" : `p-6 ${tone}`}`}>
        {block.title && <h2 className="mb-3 text-2xl font-black tracking-[-0.02em] text-slate-900">{block.title}</h2>}
        <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-600">{block.text}</p>
        {block.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {block.sources.map((source) => (
              <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 no-underline shadow-sm hover:border-slate-300 hover:text-slate-800">
                <ExternalLink className="h-3 w-3" />{source.label}
              </a>
            ))}
          </div>
        )}
      </section>
    );
  }
  if (block.type === "list") {
    const Icon = block.tone === "warning" ? X : block.tone === "info" ? Info : Check;
    return (
      <section>
        <h2 className="mb-4 text-2xl font-black tracking-[-0.02em] text-slate-900">{block.title}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {block.items.map((item, index) => (
            <li key={index} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-600">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${block.tone === "warning" ? "bg-rose-100 text-rose-600" : isKoolhaas ? "bg-teal-100 text-teal-700" : "bg-orange-100 text-orange-700"}`}>
                <Icon className="h-3 w-3" strokeWidth={2.6} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (block.type === "quoteItems") return <QuoteItemsBlock block={block} quote={quote} />;
  if (block.type === "choices") return <ChoicesBlock block={block} groups={quote.choiceGroups ?? []} />;
  if (block.type === "calculation") {
    const snapshot = block.snapshot;
    const visibleItems = snapshot.items.filter((item) => !item.optional && !item.hiddenOnQuote);
    const totalInc = snapshot.totalSalesPrice * (1 + snapshot.vatRate / 100);
    return (
      <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />Gekoppelde calculatie · {snapshot.number}
            </div>
            <h2 className="text-2xl font-black">{block.title || snapshot.title}</h2>
            {block.description && <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{block.description}</p>}
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="text-3xl font-black tracking-tight">{formatCurrency(totalInc)}</p>
            <p className="text-xs text-slate-400">incl. btw</p>
          </div>
        </div>
        {block.showItems && visibleItems.length > 0 && (
          <div className="border-t border-white/10 px-6 py-4">
            <ul className="grid gap-2 sm:grid-cols-2">
              {visibleItems.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm text-slate-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{item.description}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }
  if (block.type === "image") {
    return (
      <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={block.url} alt={block.alt} className="max-h-[480px] w-full object-contain" />
        {block.caption && <figcaption className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">{block.caption}</figcaption>}
      </figure>
    );
  }
  if (block.type === "signature") {
    return (
      <section className={`rounded-2xl border p-7 ${isKoolhaas ? "border-teal-200 bg-teal-50/60" : "border-orange-200 bg-orange-50/60"}`}>
        <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-950">{block.title}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{block.text}</p>
        <div className="mt-6 grid grid-cols-2 gap-5 text-xs text-slate-400">
          <div className="border-t border-slate-300 pt-2">Namens opdrachtgever</div>
          <div className="border-t border-slate-300 pt-2">Datum en handtekening</div>
        </div>
      </section>
    );
  }
  return null;
}

function QuoteItemsBlock({ block, quote }: { block: Extract<QuoteDocumentBlock, { type: "quoteItems" }>; quote: QuoteDocumentRenderData }) {
  const items = quote.items.filter((item) => !item.hiddenOnQuote);
  const total = items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unitPrice) * (1 + Number(item.vatRate ?? 21) / 100), 0);
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-900">{block.title}</h2>
        {block.showPrices && <span className="text-sm font-bold text-slate-500">{formatCurrency(total)} incl. btw</span>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        {items.map((item, index) => {
          const included = Number(item.indent ?? 0) > 0 || Number(item.unitPrice) === 0;
          return (
            <div key={item.id ?? index} className="flex items-start justify-between gap-5 border-b border-slate-100 px-5 py-3.5 last:border-0">
              <div className={`flex items-start gap-2 text-sm leading-6 ${included ? "text-slate-500" : "font-semibold text-slate-800"}`}>
                {included && <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" />}{item.description}
              </div>
              {block.showPrices && !included && <span className="shrink-0 text-sm font-bold text-slate-800">{formatCurrency(Number(item.qty) * Number(item.unitPrice) * (1 + Number(item.vatRate ?? 21) / 100))}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChoicesBlock({ block, groups }: { block: Extract<QuoteDocumentBlock, { type: "choices" }>; groups: RenderChoiceGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section>
      <h2 className="mb-4 text-2xl font-black tracking-[-0.02em] text-slate-900">{block.title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.flatMap((group) => group.choices).map((choice, index) => (
          <div key={choice.id ?? index} className="rounded-2xl border border-slate-200 p-5">
            {choice.label && <span className="mb-3 inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">{choice.label}</span>}
            <h3 className="text-lg font-black text-slate-900">{choice.title}</h3>
            {choice.summary && <p className="mt-2 text-sm leading-6 text-slate-500">{choice.summary}</p>}
            <ul className="mt-4 space-y-2">
              {choice.items.filter((item) => !item.hiddenOnQuote).slice(0, 8).map((item, itemIndex) => (
                <li key={item.id ?? itemIndex} className="flex items-start gap-2 text-xs leading-5 text-slate-600"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{item.description}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
