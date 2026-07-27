import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { authUrl, googleConfigured } from "@/lib/calendar/google";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar is niet ingesteld (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ontbreken)" },
      { status: 400 },
    );
  }

  // CSRF-bescherming: state in een cookie, moet straks matchen bij de callback.
  const state = randomBytes(16).toString("base64url");
  const store = await cookies();
  store.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(authUrl(state));
}
