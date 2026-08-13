import { NextRequest } from "next/server";
import { z } from "zod";
import { createDonnaDraft, donnaResponse } from "@/lib/donna";
import { donnaRoute } from "../../_shared";
const bodySchema = z.object({ company: z.enum(["koolhaas-installaties", "websup"]), customerRef: z.string().min(1).optional(), customerName: z.string().min(1).max(250).optional(), title: z.string().min(1).max(250), brief: z.string().min(1).max(20000), sourceContext: z.string().max(20000).optional() }).strict();
export async function POST(req: NextRequest) { return donnaRoute(req, async () => { const parsed = bodySchema.safeParse(await req.json()); if (!parsed.success) return donnaResponse({ error: { code: "VALIDATION_ERROR", message: "Invalid draft body", details: parsed.error.flatten() } }, 400); const quote = await createDonnaDraft(parsed.data, req.headers.get("idempotency-key") ?? undefined); return donnaResponse({ quote: { ref: quote.id, status: "draft" } }, 201); }); }
