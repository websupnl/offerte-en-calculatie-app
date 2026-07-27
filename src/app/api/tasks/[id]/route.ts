import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TASK_STATUSES } from "@/lib/tasks";
import { removeTaskFromGoogle, syncTaskToGoogle } from "@/lib/calendar/google";
import { nextOccurrence } from "@/lib/calendar/recurrence";

const schema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.number().int().min(0).max(2).optional(),
  listId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  allDay: z.boolean().optional(),
  visibility: z.enum(["INTERNAL", "SHARED"]).optional(),
  sortOrder: z.number().int().optional(),
  recurRule: z.string().nullable().optional(),
});

const taskInclude = {
  list: { select: { id: true, name: true, kind: true } },
  project: { select: { id: true, number: true, title: true } },
  customer: { select: { id: true, name: true } },
  _count: { select: { comments: true, attachments: true } },
} as const;

/**
 * Taak ophalen die deze gebruiker mag zien: óf zakelijk binnen het actieve
 * bedrijf, óf een eigen privétaak. Nooit allebei door elkaar.
 */
function ownershipWhere(session: { user: { id: string; activeCompanyId?: string } }) {
  return {
    OR: [
      ...(session.user.activeCompanyId ? [{ companyId: session.user.activeCompanyId }] : []),
      { companyId: null, ownerId: session.user.id },
    ],
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null, ...ownershipWhere(session) },
    include: {
      ...taskInclude,
      comments: { orderBy: { createdAt: "asc" } },
      attachments: true,
    },
  });
  if (!task) return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });

  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.task.findFirst({
    where: { id, deletedAt: null, ...ownershipWhere(session) },
    select: {
      id: true, companyId: true, status: true, ownerId: true, title: true,
      description: true, recurRule: true, recurUntil: true, dueAt: true,
      startAt: true, endAt: true, allDay: true, listId: true, priority: true,
      projectId: true, customerId: true, calendarEventId: true,
    },
  });
  if (!existing) return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  // Een privétaak mag niet alsnog aan zakelijke items gehangen worden.
  if (!existing.companyId && (data.projectId || data.customerId)) {
    return NextResponse.json({ error: "Privétaken kunnen niet aan zakelijke items gekoppeld worden" }, { status: 400 });
  }
  if (existing.companyId) {
    if (data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, companyId: existing.companyId }, select: { id: true } });
      if (!project) return NextResponse.json({ error: "Project niet gevonden" }, { status: 404 });
    }
    if (data.customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: data.customerId, companyId: existing.companyId }, select: { id: true } });
      if (!customer) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
    }
  }
  if (data.listId) {
    const list = await prisma.taskList.findFirst({
      where: existing.companyId
        ? { id: data.listId, companyId: existing.companyId }
        : { id: data.listId, companyId: null, ownerId: session.user.id },
      select: { id: true },
    });
    if (!list) return NextResponse.json({ error: "Lijst niet gevonden" }, { status: 404 });
  }

  const becomesDone = data.status === "DONE" && existing.status !== "DONE";
  const leavesDone = data.status && data.status !== "DONE" && existing.status === "DONE";

  const task = await prisma.task.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      listId: data.listId,
      projectId: data.projectId,
      customerId: data.customerId,
      dueAt: data.dueAt === undefined ? undefined : data.dueAt ? new Date(data.dueAt) : null,
      startAt: data.startAt === undefined ? undefined : data.startAt ? new Date(data.startAt) : null,
      endAt: data.endAt === undefined ? undefined : data.endAt ? new Date(data.endAt) : null,
      allDay: data.allDay,
      visibility: data.visibility,
      sortOrder: data.sortOrder,
      recurRule: data.recurRule,
      completedAt: becomesDone ? new Date() : leavesDone ? null : undefined,
    },
    include: taskInclude,
  });

  // Herhaling: bij afvinken meteen de volgende inplannen. Tellen vanaf de
  // gepláánde datum, niet vanaf vandaag — anders schuift een jaarlijkse keuring
  // elk jaar op omdat je 'm een week te laat afvinkt.
  let repeated: { id: string; dueAt: Date | null } | null = null;
  const rule = data.recurRule ?? existing.recurRule;
  if (becomesDone && rule && existing.dueAt) {
    const next = nextOccurrence(existing.dueAt, rule);
    if (next && (!existing.recurUntil || next <= existing.recurUntil)) {
      const shift = next.getTime() - existing.dueAt.getTime();
      const created = await prisma.task.create({
        data: {
          companyId: existing.companyId,
          ownerId: existing.ownerId,
          listId: existing.listId,
          projectId: existing.projectId,
          customerId: existing.customerId,
          title: existing.title,
          description: existing.description,
          priority: existing.priority,
          dueAt: next,
          startAt: existing.startAt ? new Date(existing.startAt.getTime() + shift) : null,
          endAt: existing.endAt ? new Date(existing.endAt.getTime() + shift) : null,
          allDay: existing.allDay,
          recurRule: rule,
          recurUntil: existing.recurUntil,
          parentTaskId: existing.id,
          source: "RECURRING",
        },
        select: { id: true, dueAt: true },
      });
      repeated = created;
    }
  }

  // Agenda bijwerken op de achtergrond — mag het opslaan nooit ophouden.
  void syncTaskToGoogle({
    id: task.id,
    title: task.title,
    description: task.description,
    startAt: task.startAt,
    dueAt: task.dueAt,
    endAt: task.endAt,
    allDay: task.allDay,
    companyId: task.companyId,
    calendarEventId: existing.calendarEventId,
    ownerId: existing.ownerId,
  });

  return NextResponse.json({ ...task, repeated });
}

/** Zachte verwijdering — belandt in de prullenbak, niet direct weg. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.task.findFirst({
    where: { id, deletedAt: null, ...ownershipWhere(session) },
    select: { id: true, ownerId: true, companyId: true, calendarEventId: true },
  });
  if (!existing) return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });

  await prisma.task.update({ where: { id }, data: { deletedAt: new Date(), calendarEventId: null } });
  void removeTaskFromGoogle(existing);
  return NextResponse.json({ ok: true });
}
