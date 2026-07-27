import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIcs } from "@/lib/calendar/ics";

export const dynamic = "force-dynamic";

/**
 * Publieke ICS-feed op een geheim token. Bewust zonder sessie: Google en Apple
 * halen deze URL zelf op, buiten de browser om. Het token is de enige sleutel,
 * dus het is intrekbaar via Instellingen (nieuw token = oude feed dood).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 20) {
    return new NextResponse("Niet gevonden", { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { calendarFeedToken: token },
    select: { id: true, name: true },
  });
  if (!user) return new NextResponse("Niet gevonden", { status: 404 });

  // Alles met een datum: zowel zakelijk als privé, want dit is jouw eigen agenda.
  const horizon = new Date();
  horizon.setFullYear(horizon.getFullYear() - 1);

  const tasks = await prisma.task.findMany({
    where: {
      ownerId: user.id,
      deletedAt: null,
      status: { notIn: ["CANCELLED"] },
      dueAt: { not: null, gte: horizon },
    },
    select: {
      id: true, title: true, description: true, dueAt: true, startAt: true,
      endAt: true, allDay: true, status: true, updatedAt: true,
      company: { select: { name: true } },
      project: { select: { number: true } },
    },
    take: 1000,
  });

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";

  const ics = buildIcs(
    tasks.map((task) => ({
      uid: `task-${task.id}@werkplek`,
      title: task.status === "DONE" ? `✓ ${task.title}` : task.title,
      description: [task.description, task.project ? `Project ${task.project.number}` : null]
        .filter(Boolean)
        .join("\n\n") || null,
      start: task.startAt ?? task.dueAt!,
      end: task.endAt,
      allDay: task.allDay,
      url: base ? `${base}/tasks?task=${task.id}` : null,
      updatedAt: task.updatedAt,
    })),
    user.name ? `Werkplek — ${user.name}` : "Werkplek",
  );

  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "content-disposition": 'inline; filename="werkplek.ics"',
    },
  });
}
