type PublicItemSource = {
  id?: unknown;
  description?: unknown;
  qty?: unknown;
  unitPrice?: unknown;
  vatRate?: unknown;
  total?: unknown;
  sortOrder?: unknown;
  indent?: unknown;
  type?: unknown;
  hiddenOnQuote?: unknown;
};

type QuoteWithItems = {
  id: string;
  items?: PublicItemSource[] | null;
  totalExVat: unknown;
  totalVat: unknown;
  choiceGroups?: unknown;
  options?: unknown;
};

export type PublicQuoteItem = {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
  total: number;
  sortOrder: number;
  indent: number;
  type: string | null;
  hiddenOnQuote: false;
};

/**
 * Return only customer-visible quote lines. If every priced line is hidden,
 * preserve the editor's saved total as one neutral summary line, provided the
 * customer has no choices or optional work that would change that total.
 */
export function publicQuoteItems(quote: QuoteWithItems): PublicQuoteItem[] {
  const visibleItems = (quote.items ?? [])
    .filter((item) => !item.hiddenOnQuote)
    .map((item) => ({
      id: String(item.id ?? ""),
      description: String(item.description ?? ""),
      qty: Number(item.qty) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      vatRate: Number(item.vatRate) || 0,
      total: Number(item.total) || 0,
      sortOrder: Number(item.sortOrder) || 0,
      indent: Number(item.indent) || 0,
      type: typeof item.type === "string" ? item.type : null,
      hiddenOnQuote: false as const,
    }));

  const hasCustomerChoices =
    (Array.isArray(quote.choiceGroups) && quote.choiceGroups.length > 0) ||
    (Array.isArray(quote.options) && quote.options.length > 0);
  const visibleAmount = visibleItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const totalExVat = Number(quote.totalExVat);
  const totalVat = Number(quote.totalVat);

  if (!hasCustomerChoices && visibleAmount === 0 && totalExVat > 0) {
    return [{
      id: `public-summary-${quote.id}`,
      description: "Werkzaamheden volgens deze offerte",
      qty: 1,
      unitPrice: totalExVat,
      vatRate: totalVat / totalExVat * 100,
      total: totalExVat,
      sortOrder: 0,
      indent: 0,
      type: "summary",
      hiddenOnQuote: false,
    }];
  }

  return visibleItems;
}
