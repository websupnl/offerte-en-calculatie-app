import { NextRequest } from "next/server";
import { z } from "zod";
import { createDonnaArticle, donnaResponse, parseLimit, searchDonnaArticles } from "@/lib/donna";
import { donnaRoute } from "../_shared";

const companySchema = z.enum(["koolhaas-installaties", "websup"]);

export async function GET(req: NextRequest) { return donnaRoute(req, async () => {
  const companyParam = req.nextUrl.searchParams.get("company");
  const company = companySchema.safeParse(companyParam);
  if (!company.success) return donnaResponse({ error: { code: "INVALID_QUERY", message: "company must be koolhaas-installaties or websup" } }, 400);
  const query = req.nextUrl.searchParams.get("query")?.trim() || undefined;
  const category = req.nextUrl.searchParams.get("category")?.trim() || undefined;
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"), 10, 25);
  const articles = await searchDonnaArticles({ company: company.data, query, category, limit });
  return donnaResponse({ articles });
}); }

const bodySchema = z.object({
  company: companySchema,
  category: z.string().min(1).max(100),
  name: z.string().min(1).max(250),
  description: z.string().max(5000).optional(),
  unit: z.string().min(1).max(30).optional(),
  price: z.coerce.number().min(0).optional(),
  costPrice: z.coerce.number().min(0).optional(),
  markupPercent: z.coerce.number().min(0).max(1000).optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  supplier: z.string().max(150).optional(),
  sku: z.string().max(100).optional(),
  ean: z.string().max(30).optional(),
}).strict();

export async function POST(req: NextRequest) { return donnaRoute(req, async () => {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return donnaResponse({ error: { code: "VALIDATION_ERROR", message: "Invalid article body", details: parsed.error.flatten() } }, 400);
  const product = await createDonnaArticle(parsed.data, req.headers.get("idempotency-key") ?? undefined);
  return donnaResponse({ article: { ref: product.id, name: product.name, sku: product.sku ?? "" } }, 201);
}); }
