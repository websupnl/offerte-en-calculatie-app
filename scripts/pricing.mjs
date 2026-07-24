export function computeSalesPrice(costPrice, markupPercent) {
  const cost = costPrice ?? 0;
  const markup = markupPercent ?? 0;
  return Math.round(cost * (1 + markup / 100) * 100) / 100;
}

/**
 * Werkt alle producten bij die aan een datasheet gekoppeld zijn: kostprijs + (indien
 * basePriceAuto aan staat) de automatisch herberekende verkoopprijs op basis van
 * inkoop x (1 + opslag%). Respecteert een handmatig vastgezette verkoopprijs.
 */
export async function updateLinkedProductPrice(prisma, datasheetId, costPrice, extra = {}) {
  const products = await prisma.product.findMany({
    where: { datasheetId },
    select: { id: true, defaultMarkupPercent: true, basePriceAuto: true },
  });

  for (const product of products) {
    const data = { costPrice, priceUpdatedAt: new Date(), ...extra };
    if (product.basePriceAuto) {
      data.basePrice = computeSalesPrice(costPrice, product.defaultMarkupPercent != null ? Number(product.defaultMarkupPercent) : 25);
    }
    await prisma.product.update({ where: { id: product.id }, data });
  }
}
