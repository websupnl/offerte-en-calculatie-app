export type CalculationLine = {
  qty: number | string;
  unitPrice: number | string;
  costPrice?: number | string | null;
  vatRate?: number | string | null;
};

export type CalculationTotals = {
  revenueExVat: number;
  costExVat: number;
  vat: number;
  revenueIncVat: number;
  profit: number;
  marginPercent: number | null;
};

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateLine(line: CalculationLine) {
  const qty = Number(line.qty) || 0;
  const unitPrice = Number(line.unitPrice) || 0;
  const costPrice = line.costPrice == null ? 0 : Number(line.costPrice) || 0;
  const vatRate = line.vatRate == null ? 21 : Number(line.vatRate) || 0;
  const revenueExVat = qty * unitPrice;
  const costExVat = qty * costPrice;

  return {
    revenueExVat: roundMoney(revenueExVat),
    costExVat: roundMoney(costExVat),
    vat: roundMoney(revenueExVat * (vatRate / 100)),
    profit: roundMoney(revenueExVat - costExVat),
  };
}

export function calculateTotals(lines: CalculationLine[]): CalculationTotals {
  const totals = lines.reduce(
    (result, line) => {
      const calculated = calculateLine(line);
      result.revenueExVat += calculated.revenueExVat;
      result.costExVat += calculated.costExVat;
      result.vat += calculated.vat;
      return result;
    },
    { revenueExVat: 0, costExVat: 0, vat: 0 },
  );

  const revenueExVat = roundMoney(totals.revenueExVat);
  const costExVat = roundMoney(totals.costExVat);
  const vat = roundMoney(totals.vat);
  const profit = roundMoney(revenueExVat - costExVat);

  return {
    revenueExVat,
    costExVat,
    vat,
    revenueIncVat: roundMoney(revenueExVat + vat),
    profit,
    marginPercent: revenueExVat > 0 ? roundMoney((profit / revenueExVat) * 100) : null,
  };
}
