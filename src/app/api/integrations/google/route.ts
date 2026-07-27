import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { googleStatus } from "@/lib/calendar/google";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await googleStatus(session.user.id));
}

/**
 * Ontkoppelen. De events die al in Google staan blijven daar staan — die zijn
 * van de gebruiker, niet van ons. Wel wissen we onze eventreferenties, zodat we
 * bij een nieuwe koppeling niet naar events wijzen die we niet meer beheren.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.userIntegration.deleteMany({
    where: { userId: session.user.id, provider: "GOOGLE_CALENDAR" },
  });
  await prisma.task.updateMany({
    where: { ownerId: session.user.id, calendarEventId: { not: null } },
    data: { calendarEventId: null, calendarSyncedAt: null },
  });

  return NextResponse.json({ ok: true });
}
