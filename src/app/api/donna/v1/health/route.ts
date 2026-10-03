import { NextRequest } from "next/server";
import { donnaResponse } from "@/lib/donna";
import { donnaRoute } from "../_shared";

const FEATURES = [
  "customers",
  "articles",
  "quotes",
  "quote-drafts",
  "quote-revise",
  "quote-calculate",
  "subscriptions",
  "billing-due",
  "agreement-gaps",
] as const;

export async function GET(req: NextRequest) {
  return donnaRoute(req, async () =>
    donnaResponse({ ok: true, service: "offerte-en-calculatie-app", features: FEATURES }),
  );
}
