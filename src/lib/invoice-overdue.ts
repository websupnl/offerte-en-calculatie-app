import { prisma } from "@/lib/prisma";
import { todayDateField } from "@/lib/business-date";

/** Houd de opgeslagen factuurstatus in lijn met de vervaldatum. Concepten,
 * nog niet verstuurde en betaalde facturen worden nooit automatisch vervallen. */
export async function markOverdueInvoices(companyId: string, invoiceId?: string): Promise<number> {
  const result = await prisma.salesInvoice.updateMany({
    where: {
      companyId,
      ...(invoiceId ? { id: invoiceId } : {}),
      status: "VERZONDEN",
      dueDate: { not: null, lt: todayDateField() },
    },
    data: { status: "VERVALLEN" },
  });
  return result.count;
}
