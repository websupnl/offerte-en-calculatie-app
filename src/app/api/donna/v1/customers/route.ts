import { NextRequest } from "next/server";
import { customerDto, donnaResponse, parseLimit } from "@/lib/donna";
import { prisma } from "@/lib/prisma";
import { donnaRoute } from "../_shared";
export async function GET(req: NextRequest) { return donnaRoute(req, async () => {
  const query = req.nextUrl.searchParams.get("query")?.trim() ?? ""; const limit = parseLimit(req.nextUrl.searchParams.get("limit"), 10, 25);
  const companies = await prisma.company.findMany({ where: { slug: { in: ["koolhaas", "websup"] } }, select: { id: true } });
  const customers = await prisma.customer.findMany({ where: { companyId: { in: companies.map((c) => c.id) }, ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }, { address: { contains: query, mode: "insensitive" } }, { city: { contains: query, mode: "insensitive" } }] } : {}) }, take: limit, orderBy: { name: "asc" } });
  return donnaResponse({ customers: customers.map(customerDto) });
}); }
