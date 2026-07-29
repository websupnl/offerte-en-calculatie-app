import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_TASK_STATUSES, TASK_STATUSES, parseQuickAdd, parseScope, scopeData, scopeWhere } from "@/lib/tasks";
import { syncTaskToGoogle } from "@/lib/calendar/google";

const createSchema = z.object({
  scope: z.enum(["business", "private"]).default("business"),
  // Óf een vrije regel die geparsed wordt, óf losse velden.
  quickAdd: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  listId: z.string().nullish(),
  projectId: z.string().nullish(),
  customerId: z.string().nullish(),
  quoteId: z.string().nullish(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.number().int().min(0).max(2).optional(),
  dueAt: z.string().datetime().nullish(),
  startAt: z.string().datetime().nullish(),
  endAt: z.string().datetime().nullish(),
  allDay: z.boolean().optional(),
  recurRule: z.string().nullish(),
  // Al bestaand Google-event linken (bv. bij "maak hiervan een taak") in
  // plaats van er een nieuw, dubbel event voor aan te maken.
  calendarEventId: z.string().optional(),
});

const taskInclude = {
  list: { select: { id: true, name: true, kind: true } },
  project: { select: { id: true, number: true, title: true } },
  customer: { select: { id: true, name: true } },
  _count: { select: { comments: true, attachments: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const scope = parseScope(params.get("scope"));
  const listId = params.get("listId");
  const projectId = params.get("projectId");
  const search = params.get("search")?.trim();
  const includeDone = params.get("includeDone") === "1";

  let where;
  try {
    where = scopeWhere(scope, { userId: session.user.id, companyId: session.user.activeCompanyId });
  } catch {
    return NextResponse.json([], { status: 200 });
  }

  const tasks = await prisma.task.findMany({
    where: {
      ...where,
      deletedAt: null,
      listId: listId ?? undefined,
      projectId: projectId ?? undefined,
      status: includeDone ? undefined : { in: [...ACTIVE_TASK_STATUSES] },
      title: search ? { contains: search, mode: "insensitive" } : undefined,
    },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { dueAt: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }, { createdAt: "desc" }],
    include: taskInclude,
    take: 500,
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  let scoped;
  try {
    scoped = scopeData(data.scope, { userId: session.user.id, companyId: session.user.activeCompanyId });
  } catch {
    return NextResponse.json({ error: "Geen actief bedrijf geselecteerd" }, { status: 400 });
  }

  // Quick-add: haal datum/tijd/prioriteit uit de ingetypte regel.
  const quick = data.quickAdd ? parseQuickAdd(data.quickAdd) : null;
  const title = data.title?.trim() || quick?.title;
  if (!title) {
    return NextResponse.json({ error: "Titel is verplicht" }, { status: 400 });
  }

  // Koppelingen mogen alleen naar dingen binnen hetzelfde bedrijf wijzen.
  if (scoped.companyId) {
    const checks: Promise<unknown>[] = [];
    if (data.projectId) checks.push(prisma.project.findFirst({ where: { id: data.projectId, companyId: scoped.companyId }, select: { id: true } }));
    if (data.customerId) checks.push(prisma.customer.findFirst({ where: { id: data.customerId, companyId: scoped.companyId }, select: { id: true } }));
    if (data.quoteId) checks.push(prisma.quote.findFirst({ where: { id: data.quoteId, companyId: scoped.companyId }, select: { id: true } }));
    const results = await Promise.all(checks);
    if (results.some((r) => !r)) {
      return NextResponse.json({ error: "Gekoppeld item niet gevonden" }, { status: 404 });
    }
  } else if (data.projectId || data.customerId || data.quoteId) {
    return NextResponse.json({ error: "Privétaken kunnen niet aan zakelijke items gekoppeld worden" }, { status: 400 });
  }

  if (data.listId) {
    const list = await prisma.taskList.findFirst({
      where: { id: data.listId, ...scopeWhere(data.scope, { userId: session.user.id, companyId: session.user.activeCompanyId }) },
      select: { id: true },
    });
    if (!list) return NextResponse.json({ error: "Lijst niet gevonden" }, { status: 404 });
  }

  const task = await prisma.task.create({
    data: {
      ...scoped,
      title,
      description: data.description,
      listId: data.listId ?? null,
      projectId: data.projectId ?? null,
      customerId: data.customerId ?? null,
      quoteId: data.quoteId ?? null,
      status: data.status ?? "OPEN",
      priority: data.priority ?? quick?.priority ?? 0,
      dueAt: data.dueAt ? new Date(data.dueAt) : quick?.dueAt ?? null,
      startAt: data.startAt ? new Date(data.startAt) : quick?.startAt ?? null,
      endAt: data.endAt ? new Date(data.endAt) : null,
      allDay: data.allDay ?? quick?.allDay ?? false,
      recurRule: data.recurRule ?? null,
      ...(data.calendarEventId ? { calendarEventId: data.calendarEventId, calendarSyncedAt: new Date() } : {}),
    },
    include: taskInclude,
  });

  // Al gekoppeld aan een bestaand Google-event (vanuit "maak hiervan een
  // taak" in de agenda) — niet nogmaals pushen, dat zou een duplicaat geven.
  const calendarSync = data.calendarEventId
    ? { status: "synced" as const }
    : await syncTaskToGoogle({
        id: task.id,
        title: task.title,
        description: task.description,
        startAt: task.startAt,
        dueAt: task.dueAt,
        endAt: task.endAt,
        allDay: task.allDay,
        companyId: task.companyId,
        calendarEventId: null,
        ownerId: scoped.ownerId,
      });

  return NextResponse.json({ ...task, calendarSync }, { status: 201 });
}
