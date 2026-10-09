import type { Prisma } from "@/generated/prisma/client";
import { calculationTextSchema } from "@/lib/calculation-text";

export async function updateCalculationText(
  tx: Pick<Prisma.TransactionClient, "calculation" | "quote" | "quoteShare">,
  id: string, companyId: string, input: unknown,
) {
  const data = calculationTextSchema.parse(input);
  const existing = await tx.calculation.findFirst({ where: { id, companyId } });
  if (!existing) return null;
  const calculation = await tx.calculation.update({
    where: { id: existing.id }, data,
    include: { customer: true, project: true, quote: true, items: { orderBy: { sortOrder: "asc" } } },
  });
  if (existing.quoteId) {
    await tx.quote.update({ where: { id: existing.quoteId }, data: { pdfUrl: null } });
    await tx.quoteShare.updateMany({ where: { quoteId: existing.quoteId }, data: { portalPdfUrl: null } });
  }
  return calculation;
}
