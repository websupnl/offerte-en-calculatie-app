import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { googleConfigured, syncTaskToGoogle } from "@/lib/calendar/google";

const BATCH_SIZE = 5;
const MAX_TASKS_PER_SYNC = 250;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!googleConfigured()) {
    return NextResponse.json({ error: "Google Calendar is niet ingesteld" }, { status: 400 });
  }

  const integration = await prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId: session.user.id,
        provider: "GOOGLE_CALENDAR",
      },
    },
    select: { id: true },
  });
  if (!integration) {
    return NextResponse.json({ error: "Google Agenda is niet gekoppeld" }, { status: 409 });
  }

  const candidates = await prisma.task.findMany({
    where: {
      ownerId: session.user.id,
      deletedAt: null,
      status: { in: ["OPEN", "DOING", "WAITING"] },
      OR: [{ startAt: { not: null } }, { dueAt: { not: null } }],
    },
    select: {
      id: true,
      title: true,
      description: true,
      startAt: true,
      dueAt: true,
      endAt: true,
      allDay: true,
      companyId: true,
      calendarEventId: true,
      ownerId: true,
    },
    orderBy: { updatedAt: "desc" },
    take: MAX_TASKS_PER_SYNC + 1,
  });

  const tasks = candidates.slice(0, MAX_TASKS_PER_SYNC);
  let synced = 0;
  let failed = 0;

  for (let index = 0; index < tasks.length; index += BATCH_SIZE) {
    const results = await Promise.all(
      tasks.slice(index, index + BATCH_SIZE).map((task) => syncTaskToGoogle(task)),
    );
    for (const result of results) {
      if (result.status === "synced") synced += 1;
      if (result.status === "failed") failed += 1;
    }
  }

  await prisma.userIntegration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date() },
  });

  return NextResponse.json({
    ok: failed === 0,
    synced,
    failed,
    limited: candidates.length > MAX_TASKS_PER_SYNC,
  });
}
