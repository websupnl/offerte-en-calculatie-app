import { NextRequest } from "next/server";
import { z } from "zod";
import { detailedQuoteDto, donnaResponse, reviseDonnaQuote } from "@/lib/donna";
import { donnaRoute } from "../../../_shared";
const bodySchema = z.object({ instruction: z.string().min(1).max(20000) }).strict();
export async function POST(req: NextRequest, { params }: { params: Promise<{ quoteRef: string }> }) { return donnaRoute(req, async () => { const parsed = bodySchema.safeParse(await req.json()); if (!parsed.success) return donnaResponse({ error: { code: "VALIDATION_ERROR", message: "Invalid revise body", details: parsed.error.flatten() } }, 400); const { quoteRef } = await params; return donnaResponse({ quote: detailedQuoteDto(await reviseDonnaQuote(quoteRef, parsed.data.instruction, req.headers.get("idempotency-key") ?? undefined)) }); }); }
