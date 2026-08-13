import { NextRequest } from "next/server";
import { detailedQuoteDto, donnaResponse, loadDonnaQuote } from "@/lib/donna";
import { donnaRoute } from "../../_shared";
export async function GET(req: NextRequest, { params }: { params: Promise<{ quoteRef: string }> }) { return donnaRoute(req, async () => { const { quoteRef } = await params; return donnaResponse({ quote: detailedQuoteDto(await loadDonnaQuote(quoteRef)) }); }); }
