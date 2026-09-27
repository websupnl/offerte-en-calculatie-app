export type PriceAuditIssue = "changed" | "inactive" | "unlinked" | "no-price" | "stale";

export type PriceAuditLine = {
  calculationId: string | null;
  calculationNumber: string | null;
  description: string;
  qty: number;
  quotedCost: number | null;
  currentCost: number | null;
  quotedSale: number;
  suggestedSale: number | null;
  priceUpdatedAt: string | null;
  issues: PriceAuditIssue[];
};

export type PriceAuditInput = {
  calculations: Array<{
    id: string;
    number: string;
    items: Array<{
      type: string;
      description: string;
      qty: number;
      costPrice: number;
      unitPrice: number;
      markupPercent: number;
      product: { active: boolean; costPrice: number | null; priceUpdatedAt: Date | null } | null;
    }>;
  }>;
  items: Array<{
    description: string;
    qty: number;
    costPrice: number | null;
    unitPrice: number;
    product: { active: boolean; costPrice: number | null; priceUpdatedAt: Date | null } | null;
  }>;
};

const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export function auditQuotePrices(input: PriceAuditInput, now = new Date()): PriceAuditLine[] {
  const staleBefore = now.getTime() - 90 * 24 * 60 * 60 * 1000;
  const lines: PriceAuditLine[] = [];

  function addLine(
    item: { description: string; qty: number; costPrice: number | null; unitPrice: number; product: PriceAuditInput["items"][number]["product"] },
    calculationId: string | null,
    calculationNumber: string | null,
    markupPercent: number | null,
  ) {
    const issues: PriceAuditIssue[] = [];
    const currentCost = item.product?.costPrice ?? null;
    if (!item.product) issues.push("unlinked");
    else {
      if (!item.product.active) issues.push("inactive");
      if (currentCost === null) issues.push("no-price");
      else if (item.costPrice !== null && roundMoney(currentCost) !== roundMoney(item.costPrice)) issues.push("changed");
      if (!item.product.priceUpdatedAt || item.product.priceUpdatedAt.getTime() < staleBefore) issues.push("stale");
    }
    lines.push({
      calculationId,
      calculationNumber,
      description: item.description,
      qty: item.qty,
      quotedCost: item.costPrice,
      currentCost,
      quotedSale: item.unitPrice,
      suggestedSale: currentCost !== null && markupPercent !== null
        ? roundMoney(currentCost * (1 + markupPercent / 100))
        : null,
      priceUpdatedAt: item.product?.priceUpdatedAt?.toISOString() ?? null,
      issues,
    });
  }

  for (const calculation of input.calculations) {
    for (const item of calculation.items) {
      if (item.type === "LABOR") continue;
      addLine(item, calculation.id, calculation.number, item.markupPercent);
    }
  }
  for (const item of input.items) {
    addLine(item, null, null, null);
  }

  return lines;
}
