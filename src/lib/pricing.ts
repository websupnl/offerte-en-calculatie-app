export function computeSalesPrice(
  costPrice: number | null | undefined,
  markupPercent: number | null | undefined,
): number {
  const cost = costPrice ?? 0;
  const markup = markupPercent ?? 0;
  return Math.round(cost * (1 + markup / 100) * 100) / 100;
}
