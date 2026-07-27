import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCode } from "@/lib/calendar/google";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  const settings = `${base}/admin/settings`;

  const params = req.nextUrl.searchParams;
  const error = params.get("error");
  if (error) return NextResponse.redirect(`${settings}?google=geweigerd`);

  const code = params.get("code");
  const state = params.get("state");
  const store = await cookies();
  const expected = store.get("google_oauth_state")?.value;
  store.delete("google_oauth_state");

  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(`${settings}?google=ongeldig`);
  }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      // Zonder refresh token kunnen we later niet verversen — dan is de
      // koppeling na een uur alsnog dood.
      return NextResponse.redirect(`${settings}?google=geen-refresh-token`);
    }

    await prisma.userIntegration.upsert({
      where: { userId_provider: { userId: session.user.id, provider: "GOOGLE_CALENDAR" } },
      create: {
        userId: session.user.id,
        provider: "GOOGLE_CALENDAR",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return NextResponse.redirect(`${settings}?google=gekoppeld`);
  } catch (err) {
    console.error("[google-calendar] koppelen mislukt:", err);
    return NextResponse.redirect(`${settings}?google=mislukt`);
  }
}
