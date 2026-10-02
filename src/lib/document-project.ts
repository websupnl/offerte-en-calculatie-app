import type { Prisma } from "@/generated/prisma";
import { generateProjectNumber } from "@/lib/format";
import { volgendVolgnummer } from "@/lib/next-number";

/** Nieuw klantdossier bij een document, binnen dezelfde transactie. */
export async function createDocumentProject(
  tx: Prisma.TransactionClient,
  data: {
    companyId: string;
    customerId: string;
    title: string;
    description?: string | null;
    status?: string;
    address?: string;
    city?: string;
    zipCode?: string;
  },
) {
  // Nummering en dossier blijven consistent bij gelijktijdig aanmaken.
  await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${data.companyId} FOR UPDATE`;
  const company = await tx.company.findUniqueOrThrow({ where: { id: data.companyId }, select: { slug: true } });
  const customer = await tx.customer.findFirstOrThrow({
    where: { id: data.customerId, companyId: data.companyId },
    select: { address: true, city: true, zipCode: true },
  });
  const prefix = generateProjectNumber(company.slug, 0).replace(/\d+$/, "");
  const existing = await tx.project.findMany({ where: { companyId: data.companyId, number: { startsWith: prefix } }, select: { number: true } });
  return tx.project.create({ data: {
    ...data,
    number: generateProjectNumber(company.slug, volgendVolgnummer(existing.map((project) => project.number), prefix)),
    status: data.status ?? "OPEN",
    address: data.address ?? customer.address,
    city: data.city ?? customer.city,
    zipCode: data.zipCode ?? customer.zipCode,
  } });
}
