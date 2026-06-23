export type InvoiceLineInput = {
  description: string;
  qty: number;
  unit?: string | null;
  unitPrice: number;
  vatRate: number;
};

export type InvoiceTotals = {
  totalExVat: number;
  totalVat: number;
  totalIncVat: number;
};

/** Bereken factuurtotalen uit regels (btw per regel). Afgerond op centen. */
export function computeInvoiceTotals(lines: InvoiceLineInput[]): InvoiceTotals {
  let ex = 0;
  let vat = 0;
  for (const l of lines) {
    const lineEx = l.qty * l.unitPrice;
    ex += lineEx;
    vat += lineEx * (l.vatRate / 100);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const totalExVat = round(ex);
  const totalVat = round(vat);
  return { totalExVat, totalVat, totalIncVat: round(totalExVat + totalVat) };
}
