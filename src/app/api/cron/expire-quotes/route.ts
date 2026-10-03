import { NextRequest, NextResponse } from "next/server";
import { markExpiredQuotes } from "@/lib/quote-expiry";

/**
 * Zet verlopen offertes (SENT/VIEWED met een verstreken validUntil) op EXPIRED.
 * Draait ook lazy bij het laden van de offertelijst en het dashboard; deze route
 * is voor een scheduler (Coolify cron) zodat het ook zonder bezoek gebeurt.
 *
 * Auth: dezelfde `x-cli-key` header als de andere CLI-routes.
 */
function authorized(req: NextRequest) {
  const key = req.headers.get("x-cli-key");
  return Boolean(key) && key === process.env.CLI_API_KEY;
}

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const count = await markExpiredQuotes();
  return NextResponse.json({ ok: true, expired: count });
}

export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}
