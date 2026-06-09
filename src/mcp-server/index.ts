import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, QuoteStatus } from "../generated/prisma/index.js";
import { z } from "zod";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for the quote MCP server.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: ["error"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const server = new McpServer({
  name: "WebsUp / Koolhaas Quote Engine",
  version: "2.0.0",
});

const quoteStatusSchema = z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"]);

const itemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullable().optional(),
  description: z.string().min(1),
  qty: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0),
  vatRate: z.coerce.number().min(0).default(21),
});

const quoteTextSchema = {
  title: z.string().optional(),
  category: z.string().optional(),
  tagline: z.string().optional(),
  itemsHeader: z.string().optional(),
  validUntil: z.string().nullable().optional(),
  intro: z.string().optional(),
  outro: z.string().optional(),
  notes: z.string().optional(),
  flow: z.any().optional(),
  approach: z.any().optional(),
  options: z.any().optional(),
  exclusions: z.any().optional(),
};

type QuoteItemInput = z.infer<typeof itemSchema>;

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function text(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
  };
}

function calculateTotals(items: QuoteItemInput[]) {
  let totalExVat = 0;
  let totalVat = 0;
  const itemsWithTotals = items.map((item, sortOrder) => {
    const total = Number(item.qty) * Number(item.unitPrice);
    const vatAmount = total * (Number(item.vatRate) / 100);
    totalExVat += total;
    totalVat += vatAmount;
    return { ...item, total, sortOrder };
  });

  return {
    itemsWithTotals,
    totalExVat,
    totalVat,
    totalIncVat: totalExVat + totalVat,
  };
}

function quoteInclude() {
  return {
    company: { select: { id: true, name: true, slug: true, branding: true, settings: true } },
    customer: true,
    items: { orderBy: { sortOrder: "asc" as const } },
    adviceDocuments: { orderBy: { createdAt: "desc" as const } },
    share: true,
  };
}

async function getDefaultUserForCompany(companyId: string) {
  const companyUser = await prisma.companyUser.findFirst({
    where: { companyId },
    orderBy: { role: "asc" },
    include: { user: true },
  });
  return companyUser?.user ?? prisma.user.findFirst();
}

async function generateQuoteNumber(companySlug: string) {
  const count = await prisma.quote.count({
    where: { company: { slug: companySlug } },
  });
  const prefix = companySlug === "koolhaas" ? "KI" : "WU";
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
}

server.tool(
  "list_companies",
  "List available companies/brands. Use companySlug when creating quotes.",
  {},
  async () => {
    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, branding: true, settings: true },
    });
    return json(companies);
  },
);

server.tool(
  "list_customers",
  "List customers, optionally scoped to a company slug.",
  {
    companySlug: z.string().optional(),
    query: z.string().optional(),
    limit: z.number().min(1).max(100).default(50),
  },
  async ({ companySlug, query, limit }) => {
    const customers = await prisma.customer.findMany({
      where: {
        company: companySlug ? { slug: companySlug } : undefined,
        OR: query
          ? [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { city: { contains: query, mode: "insensitive" } },
            ]
          : undefined,
      },
      select: { id: true, companyId: true, name: true, email: true, phone: true, address: true, city: true, zipCode: true, notes: true },
      orderBy: { name: "asc" },
      take: limit,
    });
    return json(customers);
  },
);

server.tool(
  "upsert_customer",
  "Create or update a customer. Use this before creating a quote when the customer does not exist.",
  {
    companySlug: z.string().default("koolhaas"),
    id: z.string().optional(),
    name: z.string().min(1),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    zipCode: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  },
  async ({ companySlug, id, ...data }) => {
    const company = await prisma.company.findUnique({ where: { slug: companySlug } });
    if (!company) return text(`Company not found: ${companySlug}`);

    const customer = id
      ? await prisma.customer.update({ where: { id }, data })
      : await prisma.customer.create({ data: { ...data, companyId: company.id } });

    return json(customer);
  },
);

server.tool(
  "list_products",
  "List active products/articles that can be used as quote line items.",
  {
    companySlug: z.string().default("koolhaas"),
    category: z.string().optional(),
    query: z.string().optional(),
    includeInactive: z.boolean().default(false),
    limit: z.number().min(1).max(200).default(100),
  },
  async ({ companySlug, category, query, includeInactive, limit }) => {
    const products = await prisma.product.findMany({
      where: {
        company: { slug: companySlug },
        category,
        active: includeInactive ? undefined : true,
        OR: query
          ? [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      take: limit,
    });
    return json(products);
  },
);

server.tool(
  "list_product_sets",
  "List product bundles/sets with their products and quantities.",
  {
    companySlug: z.string().default("koolhaas"),
    category: z.string().optional(),
    includeInactive: z.boolean().default(false),
  },
  async ({ companySlug, category, includeInactive }) => {
    const sets = await prisma.productSet.findMany({
      where: {
        company: { slug: companySlug },
        category,
        active: includeInactive ? undefined : true,
      },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: { product: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return json(sets);
  },
);

server.tool(
  "create_quote",
  "Create a quote with all template fields and line items. Supports WebsUp and Koolhaas via companySlug.",
  {
    companySlug: z.string().default("koolhaas"),
    customerId: z.string().min(1),
    ...quoteTextSchema,
    items: z.array(itemSchema).min(1),
    status: quoteStatusSchema.default("DRAFT"),
  },
  async ({ companySlug, customerId, items, validUntil, status, ...data }) => {
    const company = await prisma.company.findUnique({ where: { slug: companySlug } });
    if (!company) return text(`Company not found: ${companySlug}`);

    const user = await getDefaultUserForCompany(company.id);
    if (!user) return text("No user found to assign as quote creator.");

    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId: company.id } });
    if (!customer) return text(`Customer not found for ${companySlug}: ${customerId}`);

    const totals = calculateTotals(items);
    const quote = await prisma.quote.create({
      data: {
        companyId: company.id,
        customerId,
        createdById: user.id,
        number: await generateQuoteNumber(company.slug),
        status,
        ...data,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        totalExVat: totals.totalExVat,
        totalVat: totals.totalVat,
        totalIncVat: totals.totalIncVat,
        items: {
          create: totals.itemsWithTotals.map(({ id: _id, ...item }) => item),
        },
      },
      include: quoteInclude(),
    });

    return json({
      quote,
      dashboardUrl: `${appUrl}/quotes/${quote.id}`,
      printUrl: `${appUrl}/print/quotes/${quote.id}`,
    });
  },
);

server.tool(
  "get_quote",
  "Get a complete quote including customer, company, line items, share token and advice documents.",
  {
    id: z.string().min(1),
  },
  async ({ id }) => {
    const quote = await prisma.quote.findUnique({ where: { id }, include: quoteInclude() });
    if (!quote) return text(`Quote not found: ${id}`);
    return json({
      quote,
      dashboardUrl: `${appUrl}/quotes/${quote.id}`,
      printUrl: `${appUrl}/print/quotes/${quote.id}`,
      portalUrl: quote.share ? `${appUrl}/q/${quote.share.token}` : null,
    });
  },
);

server.tool(
  "search_quotes",
  "Search quotes by customer, quote number, project title, status or company.",
  {
    query: z.string().optional(),
    companySlug: z.string().optional(),
    status: quoteStatusSchema.optional(),
    limit: z.number().min(1).max(100).default(20),
  },
  async ({ query, companySlug, status, limit }) => {
    const quotes = await prisma.quote.findMany({
      where: {
        company: companySlug ? { slug: companySlug } : undefined,
        status,
        OR: query
          ? [
              { number: { contains: query, mode: "insensitive" } },
              { title: { contains: query, mode: "insensitive" } },
              { category: { contains: query, mode: "insensitive" } },
              { customer: { name: { contains: query, mode: "insensitive" } } },
              { customer: { email: { contains: query, mode: "insensitive" } } },
            ]
          : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        company: { select: { name: true, slug: true } },
        customer: { select: { id: true, name: true, email: true } },
        share: true,
        _count: { select: { items: true, adviceDocuments: true } },
      },
    });
    return json(quotes);
  },
);

server.tool(
  "update_quote",
  "Update quote text/template fields, status, validUntil and optionally replace all line items.",
  {
    id: z.string().min(1),
    customerId: z.string().optional(),
    status: quoteStatusSchema.optional(),
    ...quoteTextSchema,
    items: z.array(itemSchema).optional(),
  },
  async ({ id, items, validUntil, ...data }) => {
    const updateData: Record<string, unknown> = { ...data };

    if (validUntil !== undefined) {
      updateData.validUntil = validUntil ? new Date(validUntil) : null;
    }

    if (items) {
      const totals = calculateTotals(items);
      await prisma.$transaction([
        prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
        prisma.quoteItem.createMany({
          data: totals.itemsWithTotals.map(({ id: _id, ...item }) => ({ ...item, quoteId: id })),
        }),
        prisma.quote.update({
          where: { id },
          data: {
            ...updateData,
            totalExVat: totals.totalExVat,
            totalVat: totals.totalVat,
            totalIncVat: totals.totalIncVat,
          },
        }),
      ]);
    } else {
      await prisma.quote.update({ where: { id }, data: updateData });
    }

    const quote = await prisma.quote.findUnique({ where: { id }, include: quoteInclude() });
    return json(quote);
  },
);

server.tool(
  "delete_quote",
  "Delete a quote and all its line items/share data.",
  {
    id: z.string().min(1),
  },
  async ({ id }) => {
    await prisma.quote.delete({ where: { id } });
    return text(`Deleted quote ${id}`);
  },
);

server.tool(
  "share_quote",
  "Create or fetch the customer portal share URL for a quote and mark DRAFT quotes as SENT.",
  {
    id: z.string().min(1),
  },
  async ({ id }) => {
    const quote = await prisma.quote.findUnique({ where: { id }, include: { share: true } });
    if (!quote) return text(`Quote not found: ${id}`);

    const share = await prisma.quoteShare.upsert({
      where: { quoteId: id },
      create: { quoteId: id },
      update: {},
    });

    if (quote.status === QuoteStatus.DRAFT) {
      await prisma.quote.update({ where: { id }, data: { status: QuoteStatus.SENT } });
    }

    return json({
      token: share.token,
      portalUrl: `${appUrl}/q/${share.token}`,
      printUrl: `${appUrl}/print/portal/${share.token}`,
    });
  },
);

server.tool(
  "set_quote_status",
  "Set quote status, for example DRAFT, SENT, ACCEPTED or DECLINED.",
  {
    id: z.string().min(1),
    status: quoteStatusSchema,
  },
  async ({ id, status }) => {
    const quote = await prisma.quote.update({ where: { id }, data: { status }, include: quoteInclude() });
    return json(quote);
  },
);

server.tool(
  "list_advice_documents",
  "List AI advice documents linked to a quote.",
  {
    quoteId: z.string().min(1),
  },
  async ({ quoteId }) => {
    const documents = await prisma.adviceDocument.findMany({
      where: { quoteId },
      orderBy: { createdAt: "desc" },
    });
    return json(documents);
  },
);

server.tool(
  "get_quote_context",
  "Get everything Claude needs to reason about quote creation: companies, customers, products, sets and recent quotes.",
  {
    companySlug: z.string().default("koolhaas"),
    customerQuery: z.string().optional(),
  },
  async ({ companySlug, customerQuery }) => {
    const [company, customers, products, productSets, recentQuotes] = await Promise.all([
      prisma.company.findUnique({ where: { slug: companySlug } }),
      prisma.customer.findMany({
        where: {
          company: { slug: companySlug },
          OR: customerQuery
            ? [
                { name: { contains: customerQuery, mode: "insensitive" } },
                { email: { contains: customerQuery, mode: "insensitive" } },
              ]
            : undefined,
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.product.findMany({
        where: { company: { slug: companySlug }, active: true },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
        take: 200,
      }),
      prisma.productSet.findMany({
        where: { company: { slug: companySlug }, active: true },
        include: { items: { include: { product: true }, orderBy: { sortOrder: "asc" } } },
        orderBy: { name: "asc" },
      }),
      prisma.quote.findMany({
        where: { company: { slug: companySlug } },
        include: { customer: true, items: { orderBy: { sortOrder: "asc" } }, share: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);

    return json({ company, customers, products, productSets, recentQuotes, appUrl });
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WebsUp/Koolhaas Quote MCP Server running on stdio");
}

main()
  .catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
