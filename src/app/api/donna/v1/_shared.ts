import { NextRequest } from "next/server";
import { DonnaError, donnaResponse, requireDonnaToken } from "@/lib/donna";

export async function donnaRoute(req: NextRequest, action: () => Promise<Response>) {
  try {
    requireDonnaToken(req.headers.get("authorization"));
    return await action();
  } catch (error) {
    if (error instanceof DonnaError) return donnaResponse({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof SyntaxError) return donnaResponse({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } }, 400);
    console.error("[DONNA]", error);
    return donnaResponse({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } }, 500);
  }
}
