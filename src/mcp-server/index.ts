import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Create an MCP server
const server = new McpServer({
  name: "WebsUp Quote Engine",
  version: "1.0.0",
});

// --- Tools ---

// 1. List Customers
server.tool(
  "list_customers",
  "Retrieve a list of customers to associate with quotes.",
  {},
  async () => {
    const customers = await prisma.customer.findMany({
      select: { id: true, name: true, email: true, city: true },
      orderBy: { name: "asc" },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(customers, null, 2) }],
    };
  }
);

// 2. Create Quote
server.tool(
  "create_quote",
  "Create a new professional quote with dynamic 5-page template data.",
  {
    customerId: z.string().describe("The ID of the customer"),
    title: z.string().describe("Project title on cover (e.g., Maatwerk Website)"),
    category: z.string().describe("Project category (e.g., Webdevelopment)"),
    tagline: z.string().describe("Three key terms separated by dots (e.g., Design · Build · Grow)"),
    intro: z.string().describe("The personal intro letter content"),
    items: z.array(z.object({
      description: z.string(),
      qty: z.number().default(1),
      unitPrice: z.number(),
    })).describe("List of quote line items (deliverables)"),
    flow: z.array(z.object({
      n: z.number(),
      t: z.string(),
      d: z.string(),
    })).optional().describe("The 7-step flow items"),
    approach: z.array(z.object({
      n: z.string(),
      t: z.string(),
      d: z.string(),
    })).optional().describe("The 6-fases approach steps"),
    options: z.array(z.object({
      t: z.string(),
      d: z.string(),
      tag: z.string(),
    })).optional().describe("Optional extensions"),
    exclusions: z.array(z.string()).optional().describe("List of exclusions"),
    outro: z.string().optional().describe("The closing letter content"),
  },
  async ({ customerId, ...data }) => {
    try {
      // Basic number generation
      const count = await prisma.quote.count();
      const number = `Q-${new Date().getFullYear()}-${(count + 1).toString().padStart(3, '0')}`;

      // Get a default company and admin user
      const company = await prisma.company.findFirst();
      const user = await prisma.user.findFirst();

      if (!company || !user) {
        return {
          isError: true,
          content: [{ type: "text", text: "System not fully initialized. Company or User missing." }],
        };
      }

      // Calculate totals
      const totalExVat = data.items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
      const totalVat = totalExVat * 0.21;
      const totalIncVat = totalExVat + totalVat;

      const quote = await prisma.quote.create({
        data: {
          companyId: company.id,
          customerId,
          createdById: user.id,
          number,
          title: data.title,
          category: data.category,
          tagline: data.tagline,
          intro: data.intro,
          outro: data.outro || null,
          flow: data.flow || [],
          approach: data.approach || [],
          options: data.options || [],
          exclusions: data.exclusions || [],
          totalExVat,
          totalVat,
          totalIncVat,
          items: {
            create: data.items.map((item, idx) => ({
              description: item.description,
              qty: item.qty,
              unitPrice: item.unitPrice,
              vatRate: 21,
              total: item.qty * item.unitPrice,
              sortOrder: idx,
            })),
          },
        },
      });

      const portalUrl = `http://localhost:3000/quotes/${quote.id}`;
      return {
        content: [{ type: "text", text: `Quote created successfully!\nNumber: ${number}\nDashboard URL: ${portalUrl}` }],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error creating quote: ${error.message}` }],
      };
    }
  }
);

// 3. Search Quotes
server.tool(
  "search_quotes",
  "Search for existing quotes by customer name or project title.",
  {
    query: z.string().describe("Search term"),
  },
  async ({ query }) => {
    const quotes = await prisma.quote.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { customer: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      include: { customer: { select: { name: true } } },
      take: 10,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(quotes, null, 2) }],
    };
  }
);

// Start the server using stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WebsUp Quote MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
