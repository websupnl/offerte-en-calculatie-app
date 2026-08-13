import { NextRequest } from "next/server";
import { donnaResponse, parseLimit, quoteDto } from "@/lib/donna";
import { prisma } from "@/lib/prisma";
import { donnaRoute } from "../_shared";
export async function GET(req: NextRequest) { return donnaRoute(req, async () => {
  const customerRef = req.nextUrl.searchParams.get("customerRef") ?? undefined; const status = req.nextUrl.searchParams.get("status")?.toUpperCase(); const limit = parseLimit(req.nextUrl.searchParams.get("limit"), 20, 50);
  const validStatuses = ["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"];
  if (status && !validStatuses.includes(status)) return donnaResponse({ error: { code: "INVALID_QUERY", message: "Unknown quote status" } }, 400);
  const quotes = await prisma.quote.findMany({ where: { ...(customerRef ? { customerId: customerRef } : {}), ...(status ? { status: status as "DRAFT" } : {}) }, orderBy: { updatedAt: "desc" }, take: limit });
  return donnaResponse({ quotes: quotes.map(quoteDto) });
}); }
