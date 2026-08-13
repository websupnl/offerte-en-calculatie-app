import { NextRequest } from "next/server";
import { donnaResponse } from "@/lib/donna";
import { donnaRoute } from "../_shared";
export async function GET(req: NextRequest) { return donnaRoute(req, async () => donnaResponse({ ok: true, service: "offerte-en-calculatie-app" })); }
