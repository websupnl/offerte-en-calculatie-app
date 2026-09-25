import { prisma } from "@/lib/prisma";
import { generateProjectNumber, generateWorkOrderNumber } from "@/lib/format";
import { volgendVolgnummer } from "@/lib/next-number";
import { buildQuotePricing } from "@/lib/quote-pricing";

/**
 * Offerte of calculatie doorzetten naar project of werkbon.
 *
 * Een werkbon is intern: hij krijgt ook de regels die niet op de offerte staan
 * (hiddenOnQuote), met kostprijs. Wel alleen wat de klant echt heeft gekozen:
 * de basis, de gekozen variant en aangevinkte extra's. Abonnementen niet, die
 * zijn geen werk op locatie.
 */

export type ConvertFrom = { type: "quote" | "calculation"; id: string };

type WoLine = {
  type: "MATERIAAL" | "ARBEID";
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  costPrice: number | null;
};

async function nextNumber(
  companyId: string,
  slug: string,
  kind: "project" | "workorder",
): Promise<string> {
  const gen = kind === "project" ? generateProjectNumber : generateWorkOrderNumber;
  const prefix = gen(slug, 0).replace(/\d+$/, "");
  const rows =
    kind === "project"
      ? await prisma.project.findMany({ where: { companyId, number: { startsWith: prefix } }, select: { number: true } })
      : await prisma.workOrder.findMany({ where: { companyId, number: { startsWith: prefix } }, select: { number: true } });
  return gen(slug, volgendVolgnummer(rows.map((r) => r.number), prefix));
}

/** Alles wat nodig is om te converteren, uit één offerte of één calculatie. */
async function load(from: ConvertFrom, companyId: string) {
  const calcInclude = { items: { orderBy: { sortOrder: "asc" as const } } };
  if (from.type === "quote") {
    const quote = await prisma.quote.findFirst({
      where: { id: from.id, companyId },
      include: {
        customer: true,
        share: true,
        items: { orderBy: { sortOrder: "asc" } },
        calculations: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, include: calcInclude },
      },
    });
    if (!quote) return null;

    let lines: WoLine[];
    if (quote.calculations.length > 0) {
      const pricing = buildQuotePricing(quote.calculations);
      const chosen = Object.values((quote.share?.selectedChoiceIds ?? {}) as Record<string, string>);
      const variant = pricing.variants.find((v) => chosen.includes(v.id)) ?? pricing.variants[0] ?? null;
      const variantIds = new Set(pricing.variants.map((v) => v.id));
      const extraIds = new Set(
        Array.isArray(quote.share?.selectedOptionIds) ? (quote.share!.selectedOptionIds as string[]) : [],
      );
      const calcs = quote.calculations.filter((c) => !variantIds.has(c.id) || c.id === variant?.id);
      lines = calcs.flatMap((c) =>
        c.items
          .filter((it) => !it.recurringInterval && it.lineType !== "RECURRING" && !it.billingCycle)
          .filter((it) => !it.optional || extraIds.has(it.id))
          .map(itemToWo),
      );
    } else {
      lines = quote.items.map((it) => ({
        type: "MATERIAAL" as const,
        description: it.description,
        qty: Number(it.qty),
        unit: "stuk",
        unitPrice: Number(it.unitPrice),
        costPrice: it.costPrice != null ? Number(it.costPrice) : null,
      }));
    }
    return {
      customer: quote.customer,
      projectId: quote.projectId,
      title: quote.title && quote.title !== "Persoonlijk voorstel" ? quote.title : `${quote.category ?? "Project"} ${quote.customer.name}`,
      description: `Vanuit offerte ${quote.number}`,
      quoteId: quote.id,
      calculationIds: quote.calculations.map((c) => c.id),
      lines,
    };
  }

  const calc = await prisma.calculation.findFirst({
    where: { id: from.id, companyId },
    include: { ...calcInclude, customer: true, quote: { include: { customer: true } } },
  });
  if (!calc) return null;
  const customer = calc.customer ?? calc.quote?.customer ?? null;
  if (!customer) return { error: "Koppel eerst een klant aan deze calculatie" } as const;
  return {
    customer,
    projectId: calc.projectId ?? calc.quote?.projectId ?? null,
    title: calc.title,
    description: `Vanuit calculatie ${calc.number}`,
    quoteId: calc.quoteId,
    calculationIds: [calc.id],
    lines: calc.items
      .filter((it) => !it.recurringInterval && it.lineType !== "RECURRING" && !it.billingCycle)
      .filter((it) => !it.optional)
      .map(itemToWo),
  };
}

function itemToWo(it: {
  type: string;
  description: string;
  qty: unknown;
  unit: string | null;
  unitPrice: unknown;
  costPrice: unknown;
}): WoLine {
  return {
    type: it.type === "LABOR" ? "ARBEID" : "MATERIAAL",
    description: it.description,
    qty: Number(it.qty),
    unit: it.unit ?? (it.type === "LABOR" ? "uur" : "stuk"),
    unitPrice: Number(it.unitPrice),
    costPrice: it.costPrice != null ? Number(it.costPrice) : null,
  };
}

/** Bestaand project van de offerte/calculatie, of een nieuw project. Koppelt offerte en calculaties. */
export async function ensureProject(from: ConvertFrom, companyId: string) {
  const src = await load(from, companyId);
  if (!src) return { error: "Niet gevonden", status: 404 } as const;
  if ("error" in src) return { error: src.error, status: 400 } as const;

  let projectId = src.projectId;
  let created = false;
  if (!projectId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } });
    const number = await nextNumber(companyId, company?.slug ?? "xx", "project");
    const project = await prisma.project.create({
      data: {
        companyId,
        customerId: src.customer.id,
        number,
        title: src.title,
        description: src.description,
        address: src.customer.address,
        city: src.customer.city,
        zipCode: src.customer.zipCode,
      },
      select: { id: true },
    });
    projectId = project.id;
    created = true;
  }

  // Offerte en calculaties aan het project hangen, zodat alles op één plek staat.
  if (src.quoteId) {
    await prisma.quote.updateMany({ where: { id: src.quoteId, companyId, projectId: null }, data: { projectId } });
  }
  await prisma.calculation.updateMany({
    where: { id: { in: src.calculationIds }, companyId, projectId: null },
    data: { projectId },
  });

  return { projectId, created, src } as const;
}

export async function createWorkOrderFrom(from: ConvertFrom, companyId: string) {
  const result = await ensureProject(from, companyId);
  if ("error" in result) return result;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } });
  const number = await nextNumber(companyId, company?.slug ?? "xx", "workorder");
  const wo = await prisma.workOrder.create({
    data: {
      companyId,
      projectId: result.projectId,
      number,
      title: result.src.title,
      description: result.src.description,
      lines: {
        create: result.src.lines.map((l, i) => ({ ...l, sortOrder: i })),
      },
    },
    select: { id: true, number: true },
  });
  return { workOrderId: wo.id, number: wo.number, projectId: result.projectId } as const;
}
