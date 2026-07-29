import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { googleStatus, listForeignGoogleEvents } from "@/lib/calendar/google";
import { AgendaClient } from "./agenda-client";

export default async function AgendaPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const companyId = session?.user?.activeCompanyId;

  // Vier weken terug, twaalf vooruit — genoeg om te plannen zonder alles te laden.
  const from = new Date();
  from.setDate(from.getDate() - 28);
  from.setHours(0, 0, 0, 0);
  const until = new Date();
  until.setDate(until.getDate() + 84);

  const [tasks, feed, google, projects, googleEvents] = await Promise.all([
    // Bewust op ownerId en niet op bedrijf: dit is jouw agenda, zakelijk én privé
    // door elkaar, want je hebt er maar één dag voor.
    prisma.task.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
        status: { not: "CANCELLED" },
        dueAt: { gte: from, lte: until },
      },
      orderBy: [{ dueAt: "asc" }],
      select: {
        id: true, title: true, status: true, priority: true, dueAt: true,
        startAt: true, endAt: true, allDay: true, companyId: true, recurRule: true,
        company: { select: { name: true, slug: true } },
        project: { select: { id: true, number: true } },
      },
      take: 800,
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { calendarFeedToken: true } }),
    googleStatus(userId),
    companyId
      ? prisma.project.findMany({
          where: { companyId, status: { not: "ARCHIVED" } },
          orderBy: { createdAt: "desc" },
          select: { id: true, number: true, title: true },
          take: 200,
        })
      : Promise.resolve([]),
    listForeignGoogleEvents(userId, from, until),
  ]);

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";

  return (
    <AgendaClient
      tasks={JSON.parse(JSON.stringify(tasks))}
      feedUrl={feed?.calendarFeedToken ? `${base}/api/calendar/ics/${feed.calendarFeedToken}` : null}
      google={{ ...google, since: google.since?.toISOString() ?? null }}
      projects={projects}
      hasCompany={Boolean(companyId)}
      googleEvents={googleEvents}
    />
  );
}
