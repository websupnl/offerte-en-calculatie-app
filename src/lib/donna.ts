import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { calculateLine, calculateTotals } from "@/lib/calculation";
import { generateQuoteNumber } from "@/lib/format";
import { computeSalesPrice } from "@/lib/pricing";

export const DONNA_SCHEMA_VERSION = "1.0.0";

export class DonnaError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}

export function donnaResponse(body: Record<string, unknown>, status = 200) {
  return Response.json({ schemaVersion: DONNA_SCHEMA_VERSION, ...body }, { status });
}

export function requireDonnaToken(authorization: string | null) {
  const expected = process.env.DONNA_GATEWAY_TOKEN;
  const received = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!expected || !received) throw new DonnaError("UNAUTHORIZED", 401, "Unauthorized");
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new DonnaError("UNAUTHORIZED", 401, "Unauthorized");
  }
}

export function parseLimit(value: string | null, fallback: number, maximum: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new DonnaError("INVALID_QUERY", 400, `limit must be an integer from 1 through ${maximum}`);
  }
  return parsed;
}

export async function donnaCompany(slug: "koolhaas" | "websup") {
  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) throw new DonnaError("COMPANY_NOT_FOUND", 404, "Company is not configured");
  return company;
}

export function donnaCompanySlug(company: "koolhaas-installaties" | "websup") {
  return company === "websup" ? "websup" : "koolhaas";
}

function customerAddress(customer: { address: string | null; zipCode: string | null; city: string | null }) {
  return [customer.address, [customer.zipCode, customer.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

export function customerDto(customer: { id: string; name: string; email: string | null; address: string | null; zipCode: string | null; city: string | null }) {
  return { ref: customer.id, name: customer.name, companyName: customer.name, email: customer.email ?? "", address: customerAddress(customer) };
}

export function quoteDto(quote: { id: string; customerId: string; title: string | null; status: string; totalIncVat: unknown; updatedAt: Date }) {
  return { ref: quote.id, customerRef: quote.customerId, title: quote.title ?? "", status: quote.status.toLowerCase(), total: Number(quote.totalIncVat), currency: "EUR", updatedAt: quote.updatedAt.toISOString() };
}

function idempotencyMarker(key: string) { return `<!-- donna:idempotency:${createHash("sha256").update(key).digest("hex")} -->`; }

export async function createDonnaDraft(input: { company: "koolhaas-installaties" | "websup"; customerRef?: string; customerName?: string; title: string; brief: string; sourceContext?: string }, idempotencyKey?: string) {
  const slug = input.company === "websup" ? "websup" : "koolhaas";
  const company = await donnaCompany(slug);
  const marker = idempotencyKey ? idempotencyMarker(`${company.id}:draft:${idempotencyKey}`) : undefined;
  if (marker) {
    const existing = await prisma.quote.findFirst({ where: { companyId: company.id, notes: { contains: marker } }, orderBy: { createdAt: "desc" } });
    if (existing) return existing;
  }
  let customer = input.customerRef ? await prisma.customer.findFirst({ where: { id: input.customerRef, companyId: company.id } }) : null;
  if (input.customerRef && !customer) throw new DonnaError("CUSTOMER_NOT_FOUND", 404, "Customer was not found");
  if (!customer && input.customerName) {
    customer = await prisma.customer.findFirst({ where: { companyId: company.id, name: { equals: input.customerName, mode: "insensitive" } } });
    customer ??= await prisma.customer.create({ data: { companyId: company.id, name: input.customerName } });
  }
  // Quote.customerId is mandatory in the established data model. This neutral internal customer makes an unaddressed draft editable.
  if (!customer) {
    customer = await prisma.customer.findFirst({ where: { companyId: company.id, name: "Donna conceptklant" } })
      ?? await prisma.customer.create({ data: { companyId: company.id, name: "Donna conceptklant", notes: "Interne tijdelijke klant voor Donna-concepten." } });
  }
  const companyUser = await prisma.companyUser.findFirst({ where: { companyId: company.id }, orderBy: { id: "asc" } });
  if (!companyUser) throw new DonnaError("COMPANY_USER_NOT_FOUND", 409, "Company has no user to own the draft");
  const count = await prisma.quote.count({ where: { companyId: company.id } });
  const notes = [input.brief, input.sourceContext ? `Broncontext: ${input.sourceContext}` : "", marker ?? ""].filter(Boolean).join("\n\n");
  return prisma.quote.create({ data: { companyId: company.id, customerId: customer.id, createdById: companyUser.userId, number: generateQuoteNumber(company.slug, count + 1), title: input.title, notes, status: "DRAFT" } });
}

export async function loadDonnaQuote(ref: string) {
  const quote = await prisma.quote.findUnique({ where: { id: ref }, include: { customer: true, items: { orderBy: { sortOrder: "asc" } }, calculation: { include: { items: { orderBy: { sortOrder: "asc" } } } } } });
  if (!quote) throw new DonnaError("QUOTE_NOT_FOUND", 404, "Quote was not found");
  return quote;
}

export function detailedQuoteDto(quote: Awaited<ReturnType<typeof loadDonnaQuote>>) {
  const totals = calculateTotals(quote.items.map((item) => ({ qty: Number(item.qty), unitPrice: Number(item.unitPrice), costPrice: item.costPrice == null ? null : Number(item.costPrice), vatRate: Number(item.vatRate) })));
  return { ref: quote.id, customer: customerDto(quote.customer), title: quote.title ?? "", status: quote.status.toLowerCase(), lines: quote.items.map((item) => ({ ref: item.id, description: item.description, quantity: Number(item.qty), unitPrice: Number(item.unitPrice), costPrice: item.costPrice == null ? null : Number(item.costPrice), vatRate: Number(item.vatRate), total: Number(item.total) })), calculation: quote.calculation ? { ref: quote.calculation.id, totalCost: Number(quote.calculation.totalCostPrice), totalSales: Number(quote.calculation.totalSalesPrice), margin: Number(quote.calculation.marginAmount), marginPercent: Number(quote.calculation.marginPercent) } : {}, totals, missingInformation: quote.items.length === 0 ? ["offerteregels"] : [], updatedAt: quote.updatedAt.toISOString() };
}

export async function reviseDonnaQuote(ref: string, instruction: string, idempotencyKey?: string) {
  const quote = await loadDonnaQuote(ref);
  if (quote.status !== "DRAFT") throw new DonnaError("QUOTE_NOT_EDITABLE", 409, "Only draft quotes can be changed");
  const marker = idempotencyKey ? idempotencyMarker(`${ref}:revise:${idempotencyKey}`) : "";
  if (!marker || !quote.notes?.includes(marker)) await prisma.quote.update({ where: { id: ref }, data: { notes: [quote.notes, `Donna-instructie: ${instruction}`, marker].filter(Boolean).join("\n\n"), pdfUrl: null } });
  return loadDonnaQuote(ref);
}

export async function calculateDonnaQuote(ref: string, instruction?: string, idempotencyKey?: string) {
  const quote = await loadDonnaQuote(ref);
  if (quote.status !== "DRAFT") throw new DonnaError("QUOTE_NOT_EDITABLE", 409, "Only draft quotes can be calculated");
  const items = quote.items.map((item, sortOrder) => ({ ...item, total: calculateLine({ qty: Number(item.qty), unitPrice: Number(item.unitPrice), costPrice: item.costPrice == null ? null : Number(item.costPrice), vatRate: Number(item.vatRate) }).revenueExVat, sortOrder }));
  const totals = calculateTotals(items.map((item) => ({ qty: Number(item.qty), unitPrice: Number(item.unitPrice), costPrice: item.costPrice == null ? null : Number(item.costPrice), vatRate: Number(item.vatRate) })));
  const marker = idempotencyKey ? idempotencyMarker(`${ref}:calculate:${idempotencyKey}`) : "";
  const notes = instruction && (!marker || !quote.notes?.includes(marker))
    ? [quote.notes, `Donna-calculatie-instructie: ${instruction}`, marker].filter(Boolean).join("\n\n")
    : quote.notes;
  await prisma.$transaction(async (tx) => {
    if (items.length) { await tx.quoteItem.deleteMany({ where: { quoteId: ref } }); await tx.quoteItem.createMany({ data: items.map(({ id: _id, quoteId: _quoteId, ...item }) => ({ ...item, quoteId: ref })) }); }
    await tx.quote.update({ where: { id: ref }, data: { totalExVat: totals.revenueExVat, totalVat: totals.vat, totalIncVat: totals.revenueIncVat, notes, pdfUrl: null } });
  });
  return loadDonnaQuote(ref);
}

export function articleDto(product: { id: string; category: string; name: string; description: string | null; unit: string; basePrice: unknown; costPrice: unknown; vatRate: unknown; supplier: string | null; sku: string | null; ean: string | null; active: boolean; updatedAt: Date }) {
  return { ref: product.id, category: product.category, name: product.name, description: product.description ?? "", unit: product.unit, price: Number(product.basePrice), costPrice: product.costPrice == null ? null : Number(product.costPrice), vatRate: Number(product.vatRate), supplier: product.supplier ?? "", sku: product.sku ?? "", ean: product.ean ?? "", active: product.active, updatedAt: product.updatedAt.toISOString() };
}

export async function searchDonnaArticles(input: { company: "koolhaas-installaties" | "websup"; query?: string; category?: string; limit: number }) {
  const company = await donnaCompany(donnaCompanySlug(input.company));
  const products = await prisma.product.findMany({
    where: {
      companyId: company.id,
      active: true,
      ...(input.category ? { category: input.category } : {}),
      ...(input.query ? { OR: [{ name: { contains: input.query, mode: "insensitive" } }, { sku: { contains: input.query, mode: "insensitive" } }, { ean: { contains: input.query, mode: "insensitive" } }, { description: { contains: input.query, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    take: input.limit,
  });
  return products.map(articleDto);
}

export async function createDonnaArticle(input: { company: "koolhaas-installaties" | "websup"; category: string; name: string; description?: string; unit?: string; price?: number; costPrice?: number; markupPercent?: number; vatRate?: number; supplier?: string; sku?: string; ean?: string }, idempotencyKey?: string) {
  const company = await donnaCompany(donnaCompanySlug(input.company));
  const marker = idempotencyKey ? idempotencyMarker(`${company.id}:article:${idempotencyKey}`) : undefined;
  if (marker) {
    const existing = await prisma.product.findFirst({ where: { companyId: company.id, description: { contains: marker } } });
    if (existing) return existing;
  }
  const duplicate = await prisma.product.findFirst({
    where: { companyId: company.id, OR: [{ name: { equals: input.name, mode: "insensitive" } }, ...(input.sku ? [{ sku: { equals: input.sku, mode: "insensitive" as const } }] : [])] },
  });
  if (duplicate) throw new DonnaError("ARTICLE_ALREADY_EXISTS", 409, "An article with this name or SKU already exists");

  const basePriceAuto = input.price == null;
  const basePrice = basePriceAuto ? computeSalesPrice(input.costPrice, input.markupPercent ?? 25) : input.price!;
  const description = [input.description, marker].filter(Boolean).join("\n\n") || null;

  const product = await prisma.product.create({
    data: {
      companyId: company.id,
      category: input.category,
      name: input.name,
      description,
      unit: input.unit ?? "stuk",
      basePrice,
      basePriceAuto,
      costPrice: input.costPrice ?? null,
      priceUpdatedAt: input.costPrice != null ? new Date() : null,
      defaultMarkupPercent: input.markupPercent ?? 25,
      vatRate: input.vatRate ?? 21,
      supplier: input.supplier ?? null,
      sku: input.sku ?? null,
      ean: input.ean ?? null,
    },
  });
  return product;
}
