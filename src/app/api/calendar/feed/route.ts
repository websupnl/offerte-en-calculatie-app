import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function feedUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api/calendar/ics/${token}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { calendarFeedToken: true },
  });

  return NextResponse.json({
    url: user?.calendarFeedToken ? feedUrl(user.calendarFeedToken) : null,
  });
}

/** Nieuw token aanmaken of vervangen. Vervangen maakt de oude feed meteen dood. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = randomBytes(24).toString("base64url");
  await prisma.user.update({
    where: { id: session.user.id },
    data: { calendarFeedToken: token },
  });

  return NextResponse.json({ url: feedUrl(token) });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { calendarFeedToken: null },
  });

  return NextResponse.json({ ok: true });
}
